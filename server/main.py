# Copyright 2013 Gerwin Sturm, FoldedSoft e.U. / www.foldedsoft.at
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#         http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.


import webapp2
import httplib
import urllib
import json
import pprint

from webapp2_extras import sessions
from webapp2_extras.appengine import sessions_memcache

CLIENT_ID = "{YOUR_PAYPAL_APP_ID}"
CLIENT_SECRET = "{YOUR_PAYPAL_APP_SECRET}"

config = {}
config["webapp2_extras.sessions"] = {"secret_key": "{SOME_RANDOM_STRING}"}


def createError(code, message):
    """Create a JSON string to be returned as error response to requests"""
    return json.dumps({"error": {"code": code, "message": message}})


class MainHandler(webapp2.RequestHandler):
    """
    This URL will be used as Return URL during Paypal authentication
    
    We use the code from the request string and exchanged it against an access tokenRE
    """
    def get(self):
        code = self.request.get("code")
        if code is not None:
            conn = httplib.HTTPSConnection("api.sandbox.paypal.com")
            body = urllib.urlencode({
                "code": code,
                "client_id": CLIENT_ID,
                "client_secret": CLIENT_SECRET
            })
            conn.request(
                "POST",
                "/v1/identity/openidconnect/tokenservice?grant_type=authorization_code",
                body
            )
            response = conn.getresponse()
            data = response.read()
            conn.close()
            jsondata = json.loads(data)
            if "access_token" in jsondata:
                self.redirect("/login?access_token=%s" % jsondata["access_token"])
                return
            else:
                self.response.out.write("Authentication failed...")


class LoginHandler(webapp2.RequestHandler):
    def get(self):
        # Nothing to do here, content script will pick up accesstoken from here
        self.response.out.write("Authentication successful...")
        return


class UserHandler(webapp2.RequestHandler):
    """
    
    Return User information.
    
    We use the access token from the Authorization header in a request
    against the PayPal API
    """
    def get(self):
        self.response.headers.add_header("Access-Control-Allow-Origin", "*")
        
        # Extract access token from request header
        token = None
        authorization = self.request.headers.get("Authorization")
        if authorization is not None:
            auth = authorization.split(" ")
            if len(auth) == 2 and auth[0] == "Bearer":
                token = auth[1]
            
        if token is None:
            self.response.content_type = "application/json"
            self.response.status = 401
            self.response.out.write(createError(401, "Invalid credentials."))
            return

        # Request User information from the PayPal API
        conn = httplib.HTTPSConnection("api.sandbox.paypal.com")
        conn.request(
            "GET",
            "/v1/identity/openidconnect/userinfo/?schema=openid",
            headers={
                 "Authorization": ("Bearer %s" % token)    
            }
        )
        response = conn.getresponse()
        data = response.read()
        conn.close()
        
        # Return retrieved User Information (might want to do some error handling first)
        self.response.out.write(data)
    
    def options(self):
        # Allow CORS access from our packaged app
        self.response.headers["Access-Control-Allow-Origin"] = "*"
        self.response.headers["Access-Control-Allow-Headers"] = "Origin, X-Requested-With, Content-Type, Accept, Authorization"
        self.response.headers["Access-Control-Allow-Methods"] = "GET"


app = webapp2.WSGIApplication(
        [
         ("/user", UserHandler),
         ("/login", LoginHandler),
         ("/", MainHandler)
        ],
        debug=True, config=config)
