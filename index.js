var requestb = require("request");
const request = requestb.defaults({jar: true});

module.exports = class {
  constructor(login, password, log) {
    this.userLogin = login;
    this.userPassword = password;
    this.debugLog = log;
  }

  login(cb) {
    this.log("Authenticating..")
    this.req("GET", "https://www.mon-compte.bouyguestelecom.fr/cas/login", {}, (response, body) => {

      var jsessionid = response.headers["set-cookie"][0].match(/JSESSIONID=(.*); Path=\/cas\/; HttpOnly/)[1]
      this.log("Got jsessionid " + jsessionid);

      var lt = body.match(/<input type=\"hidden\" name=\"lt\" value=\"([a-zA-Z0-9_-]*)\"/)[1];
      this.log("Got lt value " + lt);

      var postData = {
        'username': this.userLogin,
        'password': this.userPassword,
        'rememberMe': 'true',
        '_rememberMe': 'on',
        'lt': lt,
        'execution': 'e1s1',
        '_eventId': 'submit'
      }
      this.req("POST", "https://www.mon-compte.bouyguestelecom.fr/cas/login;jsessionid=" + jsessionid + "?service=https%3A%2F%2Fwww.secure.bbox.bouyguestelecom.fr%2Fservices%2FSMSIHD%2FsendSMS.phtml", postData, (response, body) => {
        this.log("Authenticated successfully!");
        cb();
      });
    });
  }

  send(msg, numbers, cb) {
    this.login(() => {
      this.getQuota((quota) => {
        var numberscount = 0;
        if(Array.isArray(numbers)) numberscount = numbers.length;
        if((quota-numberscount) >= 0) {
          this.sendSMS(msg, numbers, () => {
            this.log("SMS successfully sent!");
          });
        }
        else this.log("Quota exceeded, message not sent");
      })

    });
  }

  getQuota(cb) {
    this.req("GET", "https://www.secure.bbox.bouyguestelecom.fr/services/SMSIHD/sendSMS.phtml", {}, (response, body) => {
      var quota = body.match(/Il vous reste <strong>(\d*) SMS gratuit\(s\)<\/strong>/)[1];
      this.log(quota + "/5 message(s) left");
      cb(quota);
    })
  }

  sendSMS(msg, numbers, cb) {
    if(Array.isArray(numbers)) {
      var numbersf = "";
      numbers.forEach((number, i) => {
        numbersf += number;
        if((numbers.length-i) !== 1) numbersf += number;
      })
      numbers = numbersf;
    }

    var postdata = {
      'fieldMsisdn': numbers,
      'fieldMessage': msg.slice(0, 161),
      'Verif.x': '51',
      'Verif.y': '16'
    }

    // Send confirmation
    this.req("POST", "https://www.secure.bbox.bouyguestelecom.fr/services/SMSIHD/confirmSendSMS.phtml", postdata, (response, body) => {
      // Valid sending
      this.req("GET", "https://www.secure.bbox.bouyguestelecom.fr/services/SMSIHD/resultSendSMS.phtml", {}, (response, body) => {
        cb();
      })
    })
  }

  req(method, url, data, cb) {
    this.log(method + " - " + url + " - " + JSON.stringify(data));
    request({ method: method, url: url, form: data }, (error, response, body) => {
      if (!error) {
        cb(response, body);
      }
    })
  }

  log(msg) {
    if(this.debugLog == 1) console.log("[Bouygues-SMS] > " + msg);
  }
}
