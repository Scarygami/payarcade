/*
 * Copyright 2013 Gerwin Sturm, FoldedSoft e.U. / www.foldedsoft.at
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *         http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

(function (global) {
  
  var game, doc = global.document, con = global.console;
  
  // Helper function to perform (authenticated) GET requests (against our server backend)
  function getRequest(url, access_token, cb) {
    var xhr = new global.XMLHttpRequest();
    
    xhr.onreadystatechange = function () {
        var response, text;
        if (xhr.readyState == 4) {
          if (xhr.status >= 200 && xhr.status <= 204) {
            text = xhr.responseText;
            response = JSON.parse(text);
            cb(response);
          } else {
            con.log("Error " + xhr.status + ": " + xhr.statusText);
            return;
          }
        }
    };
    
    xhr.open("GET", url, true);
    if (!!access_token) {
      xhr.setRequestHeader("Authorization", "Bearer " + access_token); 
    }
    xhr.send();
  }
  
  /*
   * Render Paypal Button
   *
   * After a successful authentication the return url in the appengine backend server will
   * receive a code. We exchange this code for an access token on the server side (see server/main.py)
   * and return this code to the packaged app by redirecting the user to a page including the
   * access token where a content script will pick it up and close the authentication window (see auth.js)
   */
  global.paypal.use(["login"], function (login) {
    login.render ({
      "appid": "{YOUR_PAYPAL_APP_ID}",
      "authend": "sandbox",
      "scopes": "profile email https://uri.paypal.com/services/expresscheckout",
      "containerid": "paypalSignIn",
      "locale": "en-us",
      "theme": "neutral",
      "returnurl": "https://{YOUR_APPENGINE_PROJECT}.appspot.com/"
    });
  });

  function Game(user) {
    this.user = user;
    this.credits = 0;
    this.initialize();
  }
  
  Game.prototype.initialize = function () {
    var i, buttons;
    doc.getElementById("signin").style.display = "none";
    doc.getElementById("game").style.display = "block";
    doc.getElementById("player").textContent = "Welcome " + this.user.name + "!";
    
    buttons = doc.getElementsByClassName("pay");
    con.log(buttons);
    for (i = 0; i < buttons.length; i++) {
      buttons[i].onclick = this.payclick.bind(this);
    }
    
    doc.getElementById("start").onclick = this.play.bind(this);
    
    this.displayCredits();
  };
  
  Game.prototype.payclick = function (event) {
    var amount = event.target.dataset.amount, new_credits;
    
    if(!amount) {
      amount = event.target.parentNode.dataset.amount; 
    }
    if(!amount) {
      amount = event.target.parentNode.parentNode.dataset.amount; 
    }

    if (!!amount) {
        /*
         * TODO:
         * Here a seamless express checkout would start
         * Details about this flow available in the official docs: 
         * https://developer.paypal.com/webapps/developer/docs/integration/direct/log-in-with-paypal/js_button/#processPayment
         * The actual handling payment would be done on the server with a callback url
         * similar to how authentication was handled to report back to the packaged app        
         */
        new_credits = amount / 0.5;
        this.credits += new_credits;
        this.displayCredits();
    }
  };
  
  Game.prototype.displayCredits = function () {
    doc.getElementById("credits").textContent = this.credits + " CREDITS";
    if (this.credits > 0) {
      doc.getElementById("insert").innerHTML = "CLICK START<br>TO CONTINUE"
      doc.getElementById("start").classList.add("enabled");
    } else {
      doc.getElementById("insert").innerHTML = "INSERT COIN<br>TO CONTINUE"
      doc.getElementById("start").classList.remove("enabled");
    }
  };
  
  Game.prototype.play = function (event) {
    var gameplay = doc.getElementById("gameplay"), that = this;
    if (this.credits > 0 && event.target.classList.contains("enabled")) {
      this.credits = this.credits - 1;
      this.displayCredits(false);
      doc.getElementById("start").classList.remove("enabled");
      doc.getElementById("insert").style.display = "none";

      // Amazing game loop starts here!!1!
      gameplay.innerHTML = "LEVEL 1<br>START";
      gameplay.style.display = "block";
      global.setTimeout(function () {
        gameplay.innerHTML = "BEAT UP<br>FIRST ENEMY";
        global.setTimeout(function () {
          gameplay.innerHTML = "FIGHT AGAINST<br>TWO ENEMIES";
          global.setTimeout(function () {
            gameplay.innerHTML = "BOSS FIGHT<br>!!!!!!1!";
            global.setTimeout(function () {
              gameplay.innerHTML = "LEVEL 2<br>START";
              global.setTimeout(function () {
                gameplay.innerHTML = "MORE &amp; TOUGHER<br>ENEMIES";
                global.setTimeout(function () {
                  gameplay.innerHTML = "NINJA ASSASSIN<br>FROM BEHIND";
                  global.setTimeout(function () {
                    gameplay.innerHTML = "GAME<br>OVER";
                    global.setTimeout(function () {
                      gameplay.style.display = "none";
                      doc.getElementById("insert").style.display = "block";
                      that.displayCredits();
                    }, 1000);
                  }, 1000);  
                }, 1000);
              }, 1000);
            }, 1000);
          }, 1000);
        }, 1000);
      }, 1000);
    }
  }
  
  // Listen for messages from other parts of our packaged app (content scripts)
  global.chrome.extension.onMessage.addListener(
    function (request, sender) {
      if (!!request.access_token) {
        /*
         * Once we receive the access token via the content script on our server redirect URI
         * we use it in a request for User information against the PayPal API.
         * This checks whether it actually is a valid access token
         * and allows us to personalize the game for the user
         */
        getRequest(
          "https://{YOUR_APPENGINE_PROJECT}.appspot.com/user", request.access_token,
          function (user) {
            con.log(user);
            if (!!user) {
              user.access_token = request.access_token;
              game = new Game(user);
            }
          }
        );
      }
    }
  );

}(this));