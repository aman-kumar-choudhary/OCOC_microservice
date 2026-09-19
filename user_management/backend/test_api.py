import urllib.request
import json

req = urllib.request.Request("http://127.0.0.1:8000/api/v1/hostel/permissions")
req.add_header("Content-Type", "application/json")
# We need a token, but we don't have one. We can check if it returns 401.
try:
    urllib.request.urlopen(req, data=b"{}")
except urllib.error.HTTPError as e:
    print(e.code, e.read().decode())
