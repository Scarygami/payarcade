(function (global) {
    var params, i, param;
    if (global.location.search !== "") {
      // Extract access token from Server Redirect URL
      params = global.location.search.substring(1).split("&");
      for (i = 0; i < params.length; i++) {
        param = params[i].split("=");
        if (param[0] === "access_token") {
          // pass access_token to our main script
          global.chrome.extension.sendMessage({"access_token": param[1]});
          
          // close authentication popup window
          global.open("", "_self", "");
          global.close();
        }
      }
    }
}(this));