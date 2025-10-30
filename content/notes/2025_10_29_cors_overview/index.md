+++
title = "CORS"
date = "2025-10-29"
summary = "Cross-Origin Resource Sharing"
tags = ["Web", "JavaScript"]
type = "note"
toc = true
readTime = true
autonumber = false
showTags = false
slug = "cors-overview"
+++

## Intro

### Setting up the Front-End Code

Let's start with the following HTML:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light dark">
    <link rel="stylesheet" href="css/concrete.min.css">
    <title>Foobar</title>
  </head>
  <body>
    <main>
      <h1>Demo</h1>
      <p id="greeting">Loading...</p>
    </main>
    <script src="./script.js"></script>
  </body>
</html>
```

and javascript:

```javascript
document.addEventListener("DOMContentLoaded", () => {
  // set greeting
  const greetingEl = document.getElementById("greeting");
  const name = "John Doe";
  greetingEl.textContent = `Hello, ${name}!`;
});
```

I am using [parcel](https://parceljs.org/) as a quick tool to set up the
frontend.

### Setting up the backend code

As for the backend, we've got the following flask server:

```python
import datetime as dt

from flask import Flask, jsonify, request

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 1024 * 1024  # 1 MB JSON payload limit


@app.errorhandler(413)
def request_entity_too_large(error):
    return jsonify({"error": "Payload too large"}), 413


@app.route("/greet", methods=["POST"])
def greet():
    data = request.get_json(silent=True)
    if not data or "name" not in data:
        return jsonify({"error": "Missing required field: 'name'"}), 400

    name = data.get("name")
    lang = data.get("lang", "en").lower()

    greetings = {"en": "Hello", "es": "Hola", "fr": "Bonjour"}
    greeting = greetings.get(lang)
    if greeting is None:
        return jsonify(
            {"error": f"Invalid or unsupported language selection: '{lang}'"}
        ), 400

    result = {
        "greeting": f"{greeting}, {name}!",
        "timestamp": dt.datetime.now(dt.UTC).isoformat() + "Z",
    }

    return jsonify(result)


if __name__ == "__main__":
    app.run(
        host="localhost",
        port=5000,
        debug=True,
    )
```

On running the backend server, we can see some of the expected output via
httpie:

```
> http --print=b POST :5000/greet
{
    "error": "Missing required field: 'name'"
}


> http --print=b POST :5000/greet name="Alice" lang="foo"
{
    "error": "Invalid or unsupported language selection: 'foo'"
}


> http --print=b POST :5000/greet name="Alice" lang="es"
{
    "greeting": "Hola, Alice!",
    "timestamp": "2025-10-22T13:05:27.121465+00:00Z"
}
```

### Making a POST request from the frontend

Now, let's try retrieving the greeting via frontend which is being served via
Parcel by default on port 1234:

```javascript
const API_BASE_URL = "http://localhost:5000";

async function fetchGreeting(name, lang) {
  const response = await fetch(`${API_BASE_URL}/greet`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name, lang }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Server error: ${response.status}`);
  }
  return response.json();
}

document.addEventListener("DOMContentLoaded", async () => {
  // set greeting
  const greetingEl = document.getElementById("greeting");
  const name = "Alice";
  try {
    const { greeting } = await fetchGreeting(name, "es");
    greetingEl.textContent = greeting;
  } catch (error) {
    greetingEl.textContent = "Error: failed to fetch greeting";
    const errorEl = document.createElement("pre");
    errorEl.textContent = error.message;
    errorEl.style.color = "red";
    errorEl.style.whiteSpace = "pre-wrap";
    greetingEl.insertAdjacentElement("afterend", errorEl);
    console.error(error);
  }
});
```

Unfortunately, we get the following error (at the browser console):

```
Access to fetch at 'http://localhost:5000/greet' from origin
'http://localhost:1234' has been blocked by CORS policy: Response to preflight
request doesn't pass access control check: No 'Access-Control-Allow-Origin'
header is present on the requested resource.

script.js:4
 POST http://localhost:5000/greet net::ERR_FAILED
fetchGreeting	@	script.js:4
(anonymous)	@	script.js:23

script.js:32 TypeError: Failed to fetch
    at fetchGreeting (script.js:4:26)
    at HTMLDocument.<anonymous> (script.js:23:32)
(anonymous)	@	script.js:32
```

### Fixing the CORS error

Now, this can be fixed easily by using `flask_cors` flask extension:

```python
import datetime as dt

from flask import Flask, jsonify, request

from flask_cors import CORS

app = Flask(__name__)
CORS(app)
```

But having experienced CORS issues recently, I wanted to take the opportunity to
actually learn what CORS really is about, what does it prevent or solve and all
that. Hence this blog post.

First, let's see how to fix it manually without `flask_cors`. The fix is
entirely in the backend:

```python
@app.route("/greet", methods=["OPTIONS"])
def greet_options():
    response = make_response()
    response.headers["Access-Control-Allow-Origin"] = "http://localhost:1234"
    response.headers["Access-Control-Allow-Methods"] = "POST, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    response.status_code = 204  # No Content
    return response


@app.route("/greet", methods=["POST"])
def greet():
    data = request.get_json(silent=True)
    if not data or "name" not in data:
        response = jsonify({"error": "Missing required field: 'name'"})
        response.headers["Access-Control-Allow-Origin"] = "http://localhost:1234"
        return response, 400

    name = data.get("name")
    lang = data.get("lang", "en").lower()

    greetings = {"en": "Hello", "es": "Hola", "fr": "Bonjour"}
    greeting = greetings.get(lang)
    if greeting is None:
        response = jsonify(
            {"error": f"Invalid or unsupported language selection: '{lang}'"}
        )
        response.headers["Access-Control-Allow-Origin"] = "http://localhost:1234"
        return response, 400

    result = {
        "greeting": f"{greeting}, {name}!",
        "timestamp": dt.datetime.now(dt.UTC).isoformat() + "Z",
    }

    response = jsonify(result)
    response.headers["Access-Control-Allow-Origin"] = "http://localhost:1234"
    return response
```

### Quick Refactor of Backend Code

This code fixes the CORS issue but before proceeding, let's clean it up a little
bit:

- validation checks are scattered all over, should be centralized
- `http://localhost:1234` is a magic string and should be placed in a named
  constant to avoid duplication and make it easier to change

```python
import datetime as dt
from dataclasses import dataclass
from typing import Any, Dict, Optional, Tuple

ALLOWED_ORIGIN = "http://localhost:1234"


@dataclass
class GreetingRequest:
    name: str
    lang: str


def parse_greeting_request(
    data: Optional[Dict[str, Any]],
) -> Tuple[Optional[GreetingRequest], Optional[Dict[str, str]]]:
    if not data:  # check if data exists
        return None, {"error": "Missing request body"}

    if "name" not in data:  # name is a required field
        return None, {"error": "Missing required field: 'name'"}

    name = data["name"]  # name should not be an empty string
    if not name or not name.strip():
        return None, {"error": "Field 'name' cannot be empty"}

    # check and validate language
    lang = data.get("lang", "en").lower()
    valid_languages = {"en", "es", "fr"}
    if lang not in valid_languages:
        return None, {"error": f"Invalid or unsupported language selection: '{lang}'"}
    return GreetingRequest(name=name.strip(), lang=lang), None


@app.route("/greet", methods=["POST", "OPTIONS"])
def greet():
    # OPTIONS
    if request.method == "OPTIONS":
        response = make_response()
        response.headers["Access-Control-Allow-Origin"] = ALLOWED_ORIGIN
        response.headers["Access-Control-Allow-Methods"] = "POST, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type"
        response.status_code = 204  # No Content
        return response

    # POST
    payload = request.get_json(silent=True)
    req, error = parse_greeting_request(payload)

    if error:
        response = jsonify(error)
        response.headers["Access-Control-Allow-Origin"] = ALLOWED_ORIGIN
        return response, 400

    # from here on, greeting is valid
    assert req is not None
    greetings = {"en": "Hello", "es": "Hola", "fr": "Bonjour"}
    result = {
        "greeting": f"{greetings[req.lang]}, {req.name}!",
        "timestamp": dt.datetime.now(dt.UTC).isoformat() + "Z",
    }

    response = jsonify(result)
    response.headers["Access-Control-Allow-Origin"] = ALLOWED_ORIGIN
    return response
```

## CORS: The Big Picture

When I used `httpie` (an alternative to curl), I did not get any CORS 'errors'.
However, when I used the browser, I did. Let's step back a bit and see why:
Users use user agents to access web resources. User agents include browsers
(Chrome, Firefox) and command-line tools (httpie, curl). With my browser, I got
CORS errors because it has to enforce some security policies to protect users
(me) whereas command-line tools such as curl don't have to.

Within a browser, users typically have multiple websites open in different tabs
and windows. Each website runs its own JavaScript and the browser has to keep
the websites isolated such that a script running for one origin (e.g. evil.com)
is prevented from accessing the user's data that's on a different origin (e.g.
bank.com). This browser-enforced security policy is what's called "Same-Origin
Policy" (SOP) and is what provides the isolation. As such, CORS (Cross-Origin
Resource Sharing) is a mechanism that allows servers to selectively relax SOP by
sending HTTP headers that browsers recognize and enforce. SOP is the security
measure (blocks cross-origin access by default) and CORS is the relaxation
mechanism (allows it when explicitly permitted).

Btw, it's worth pointing out, curl/httpie don't need to enforce SOP because they
do not execute arbitrary JavaScript from multiple origins within the same
process. The user (me) explicitly controls each request and there's no risk of a
malicious script leveraging my authenticated sessions to steal data from other
origins

### Same-origin Policy

References:

- [web.dev Same-origin policy](https://web.dev/articles/same-origin-policy)
- [MDN Same-origin policy](https://developer.mozilla.org/en-US/docs/Web/Security/Same-origin_policy)

SOP: "The same-origin policy is a browser security feature that restricts how
documents and scripts on one origin can interact with resources on another
origin" - web.dev.

What is considered same-origin: "An origin is defined by the scheme (also known
as the protocol, for example HTTP or HTTPS), port (if it is specified), and
host. When all three are the same for two URLs, they are considered same-origin.
For example, http://www.example.com/foo is the same origin as
http://www.example.com/bar but not https://www.example.com/bar because the
scheme is different" - web.dev.

Also note, `https://www.example.com` and `https://api.example.com` are
considered different origins since 'www.example.com' and 'api.example.com' are
different hosts as per the browser even though they share the same domain
'example.com'. Is this the right call, it does seem a bit restrictive? Well it's
the right call security-wise for two key reasons:

1. **Organizational separation**: (e.g admin.example.com vs blog.example.com) -
   This is defense-in-depth. It's a minor nuisance requiring CORS configuration,
   but provides valuable isolation: if blog.example.com is compromised (e.g. via
   WordPress vulnerability), scripts from that subdomain cannot read responses
   from admin.example.com.
2. **Multi-tenancy** (e.g alice.notion.so and bob.notion.so) - This separation
   is absolutely necessary. JavaScript running on alice.notion.so must not be
   able to fetch and read data from bob.notion.so.

The web is built on cross-origin requests. A typical web page might load images
from some host, CSS files from a different host, embed a video from some other
host and so on. As such, not all cross origin requests are blocked by SOP.

**General rule**: "Embedding cross-origin resources is permitted; reading
cross-origin resources is blocked" - web.dev. Reading in this case means
accessing the content/data of the resource programmatically via JavaScript.

Specifically permitted cross-origin resources (web.dev, MDN):

- **iframes**: one can embed cross-origin websites within an iframe (unless
  blocked by `X-Frame-Options` or CSP headers), but cannot read the iframe's
  DOM/content via JavaScript
- **CSS**: one can embed cross-origin CSS files via `<link>` or `@import`
  (correct `Content-Type` header is required i.e. `Content-Type: text/css`)
- **Forms**: one can submit to cross-origin URLs via `action` attribute. This
  raises separate security concerns at the backend since the server cannot
  assume that the form data is from its own origin (check out
  [CSRF](https://developer.mozilla.org/en-US/docs/Web/Security/Attacks/CSRF)).
- **Images**: one can embed and display images from cross-origin sources via
  `<img>`, but cannot read the pixel/binary data via JavaScript
- **Video/Audio**: one can embed cross-origin videos and audios via `<video>`
  and `<audio>` elements e.g. from YouTube.
- **Scripts**: one can embed cross-origin scripts via `<scrupt src="...">` but
  cross-origin fetch/XHR requests from such scripts are still subject to
  SOP/CORS based on the page's origin, not the script's origin
- **Fonts**: one can apply cross-origin fonts via `@font-face`. Some browsers
  allow cross-origin fonts, others require same-origin
- **Plugins**: one can embed external resources with `<object>` and `<embed>`
  elements

### CORS: HTTP Headers for Requests and Responses

References:

- [web.dev Cross-Origin Resource Sharing (CORS)](https://web.dev/articles/cross-origin-resource-sharing)
- [MDN Cross-Origin Resource Sharing (CORS)](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS)
- [OWASP - Testing Cross Origin Resource Sharing](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/11-Client-side_Testing/07-Testing_Cross_Origin_Resource_Sharing)

A bit of an overview:

- CORS works via HTTP headers for the request and response
- There are two types of cross-origin requests: simple requests and preflighted
  requests

**Simple Requests:**

- Before sending the request the browser adds an `Origin` header to the request
  e.g. `http://localhost:1234`
- The `Origin` header is a
  [Forbidden request header](https://developer.mozilla.org/en-US/docs/Glossary/Forbidden_request_header),
  we aren't allowed to set it or modify it via JavaScript
- The server (e.g. running at `http://localhost:5000`) receives the request and
  should check `Origin`. As part of the response, it adds
  `Access-Control-Allow-Origin` to the header with the appropriate value (e.g.,
  `http://localhost:1234`)
- Once the browser receives the response, it determines whether to allow
  JavaScript to read the response based on the CORS headers

**Preflighted Requests:**

- For non-simple requests, the browser first sends a preflight OPTIONS request
  before the actual request
- The preflight includes:
  - `Origin`: where the request is coming from
  - `Access-Control-Request-Method`: the HTTP method of the actual request
  - `Access-Control-Request-Headers`: any custom headers that will be used
- The server responds to the preflight with:
  - `Access-Control-Allow-Origin`: allowed origin
  - `Access-Control-Allow-Methods`: allowed HTTP methods
  - `Access-Control-Allow-Headers`: allowed custom headers
  - `Access-Control-Max-Age` (optional): how long to cache this preflight
- If the preflight succeeds (server approves), the browser then sends the actual
  request with only the `Origin` header
- If the preflight fails, the actual request is never sent by the browser

### Client HTTP request headers for CORS

- `Origin`:
  - Tells server where the request is coming from i.e. the origin
  - Set by browser automatically, JavaScript cannot modify it
  - Used in all cross-origin requests both simple and preflighted
  - Can be null in certain cases ie the browser does not have a meaningful
    origin (eg if the user opened a local HTML file with `file:///`) for the
    rest or it is intentionally hiding it for privacy/security reasons
  - If the API should only be accessed from known origins then the server should
    reject requests with `"null"` origin. Null should not be inclded in the
    allow list
- `Access-Control-Request-Method`:
  - Used in preflight OPTIONS requests only to tell the server what HTTP method
    will be used in the actual request e.g. POST, PUT, DELETE. Note included in
    the actual request after preflight
  - Set by browser automatically, JavaScript cannot modify it
- `Access-Control-Request-Headers`:
  - Used in preflight OPTIONS requests only to tell the server what custom
    headers will be used in the actual request. Not included in the actual
    request after preflight
  - Set automatically by the browser, cannot be modified via JavaScript
  - Any header that is not in the CORS-safelisted request headers (and thus
    triggers preflight) is considered "custom" e.g. "Cache-Control" and
    "Authorization"

### Server HTTP response headers for CORS

- `Access-Control-Allow-Origin`:
  - Allowed values: `<origin>` or wildcard `*`
  - It's for the server to tell the browser either that specific origin is
    allowed to access the resource OR with the wildcard, any origin is allowed
    to access the resource
  - Though if the request from the browser contains any credentials (cookies,
    authorization headers or TLS client certificates) but the server replies
    with a wildcard for allowed origins, then (for security), the browser blocks
    the script from reading the response
- `Vary`:
  - A general HTTP header for caches (CDNs, reverse proxies, browser) rather
    than a CORS-related header
  - Can be set to wildcard `*` meaning the response is uncacheable OR one or
    more specific request header names
  - If set as `Vary: Origin` it means: cache separately for each `origin` value
    in the request header e.g. requests from `alice.example.com` and
    `bob.example.com` get separate cache entries, even if all other headers are
    identical
  - Required for CORS when the server dynamically sets
    `Access-Control-Allow-Origin` to different origins from an allowlist
  - Prevents caches from serving response with the wrong origin to another
    origin
- `Access-Control-Allow-Methods`:
  - for server to list the specific "methods allowed when accessing the
    resource" - MDN
  - used in response to a preflight OPTIONS request
  - including OPTIONS is harmless and superfluous for preflight purposes
    initiated automatically by the browser alone. It's only necessary if you
    want to allow JavaScript to make actual OPTIONS requests e.g. for API
    discovery mechanisms.
- `Access-Control-Allow-Headers`:
  - for server to list the specific HTTP headers that can be used when making
    the actual request
  - used in response to a preflight OPTIONS request
- `Access-Control-Allow-Credentials`:
  - for server to tell the browser whether credentials (cookies, authz headers,
    TLS certs) can be included in cross-origin requests
  - can only be set to `true` (no other value is valid)
  - If any cross-origin request (both simple and non-simple) sent by the browser
    included credentials but the server did not set this header in its response
    then the browser will block JavaScript from reading the response.
  - Note: if the server sets this header, then it must specify a specific origin
    in `Access-Control-Allow-Origin` rather than the wildcard.
- `Access-Control-Expose-Headers`:
  - for server to list which response headers JavaScript is allowed to read
  - by default, JavaScript is allowed to read the following headers:
    Cache-Control, Content-Language, Content-Length, Content-Type, Expires,
    Last-Modified, Pragma. These are considered "safe" to be exposed
  - For any header outside of these that the server wants browser-based
    JavaScript to read, it must list it in this header field
- `Access-Control-Max-Age`:
  - for caching preflight response in the browser so that the browser does not
    need to send OPTIONS requests repeatedly
  - set to number of seconds
  - cached per specific combination of endpoint (URL), HTTP method, headers and
    origin

### Rejecting Cross-Origin Requests

Suppose a server receives a request from an origin that is not in its allow
list. For **simple requests**, the server has 2 options:

1. **Don't include the CORS headers**: the server receives and processes the
   request and sends the response minus the CORS headers. The browser blocks
   JavaScript from reading the response. Other user agents like curl/httpie will
   read the response quite fine
2. **Return an error status**: e.g. 403. Server receives the request but rejects
   it with a 403. Browser also blocks it since there's no CORS headers.
   JavaScript cannot see the 403 status, it just sees a generic network/CORS
   error. The browser console shows the CORS error.

For **preflight requests**, the server should reject at the OPTIONS stage in two
ways:

1. **Dont include the CORS headers for the preflight response**: Browser
   receives the OPTIONS response but since it doesn't have the requisite CORS
   headers, it never sends the actual request
2. **Return error status for preflight**: eg. 403. Since the preflight request
   is errored out, the browser never sends the actual request

Let's rewrite the handler such that we've got multiple allowed origins, plus
incorporate other stuff we've come along:

```python
ALLOWED_ORIGINS = {"http://localhost:1234", "https://app.example.com"}


def add_cors_headers(response, origin):
    # add CORS headers to response if origin is in allowed origins
    if origin in ALLOWED_ORIGINS:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Vary"] = "Origin"
    return response


@app.route("/greet", methods=["POST", "OPTIONS"])
def greet():
    origin = request.headers.get("Origin")

    # handle preflight
    if request.method == "OPTIONS":
        if origin not in ALLOWED_ORIGINS:
            return make_response(), 403

        response = make_response()
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Methods"] = "POST"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type"
        response.headers["Access-Control-Max-Age"] = "60"
        response.headers["Vary"] = "Origin"
        response.status_code = 204  # No Content
        return response

    # handle POST
    payload = request.get_json(silent=True)
    req, error = parse_greeting_request(payload)

    if error:
        response = jsonify(error)
        return add_cors_headers(response, origin), 400

    # from here on, greeting is valid
    assert req is not None
    greetings = {
        "en": "Hello",
        "es": "Hola",
        "fr": "Bonjour",
    }
    result = {
        "greeting": f"{greetings[req.lang]}, {req.name}!",
        "timestamp": dt.datetime.now(dt.UTC).isoformat() + "Z",
    }

    response = jsonify(result)
    return add_cors_headers(response, origin)
```

## Simple Requests and Preflight Requests

**Simple requests**: use only GET/HEAD/POST with CORS-safelisted headers.

**Non-simple requests**: either use other methods or custom headers or
non-safelisted content-types such as `application/json`. These require a
preflight OPTIONS request first to get server permission.

A bit of repetition but here's how web.dev explains it:

> When a web app makes a complex HTTP request, the browser adds a preflight
> request to the beginning of the request chain.
>
> The CORS specification defines a complex request as follows:
>
> - A request that uses methods other than GET, POST, or HEAD.
> - A request that includes headers other than Accept, Accept-Language or
>   Content-Language.
> - A request that has a Content-Type header other than
>   application/x-www-form-urlencoded, multipart/form-data, or text/plain.
>
> Browsers automatically create any necessary preflight requests and send them
> before the actual request message. The preflight request is an OPTIONS request
> like the following example:
>
> The server response can also include an Access-Control-Max-Age header to
> specify the duration in seconds to cache preflight results. This allows the
> client to send multiple complex requests without needing to repeat the
> preflight request.

In my case, even though it's a POST request, the requested content is json hence
it triggers a preflight request:

Here's the preflight request that my browser makes, it's essentially asking 'can
I send a POST request?':

```
Incoming request: OPTIONS /greet
        Host: localhost:5000
        Connection: keep-alive
        Accept: */*
        Access-Control-Request-Method: POST
        Access-Control-Request-Headers: content-type
        Origin: http://localhost:1234
        User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36
        Sec-Fetch-Mode: cors
        Sec-Fetch-Site: same-site
        Sec-Fetch-Dest: empty
        Referer: http://localhost:1234/
        Accept-Encoding: gzip, deflate, br, zstd
        Accept-Language: en-US,en;q=0.9
```

- `Host`: the server hostname + port that the browser is sending the request to
- `Connection: keep-alive`: don't close TCP after this request
- `Accept: */*`: browser will accept any content type in response -
- `Access-Control-Request-Method: POST`: tell server which method the actual
  request will use
- `Access-Control-Request-Headers: content-type`: tell server the list of
  headers it will use for the actual request
- `Origin: http://localhost:1234`: tell server where the request originates
  from, can't be modified by JS
- `User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like
  Gecko) Chrome/141.0.0.0 Safari/537.36`:
  browser identification
- `Sec-Fetch-Mode: cors`: security header, indicates this is a cors request
- `Sec-Fetch-Site: same-site`: different port but same 'domain' (localhost:1234
  & localhost:5000) are treated as same domain
- `Sec-Fetch-Dest: empty`: destination
- `Referer: http://localhost:1234/`: the page URL that initiated this request
- `Accept-Encoding: gzip, deflate, br, zstd`: compression algos the browser
  supports
- `Accept-Language: en-US,en;q=0.9`: preferred languages

Here's the backend's response to the preflight request:

```
Outgoing response: 204 NO CONTENT
        Content-Type: text/html; charset=utf-8
        Access-Control-Allow-Origin: http://localhost:1234
        Access-Control-Allow-Methods: POST
        Access-Control-Allow-Headers: Content-Type
        Access-Control-Max-Age: 60
        Vary: Origin
```

- `Content-Type: text/html; charset=utf-8`: Flask default, not really needed
  since there's no content
- `Access-Control-Allow-Origin: http://localhost:1234`: Tells browser this
  origin is allowed
- `Access-Control-Allow-Methods: POST`: Tells browser this method is allowed for
  the actual request
- `Access-Control-Allow-Headers: Content-Type`: tells browser this header(s) is
  allowed for the actual request
- `Access-Control-Max-Age: 60`: cache the preflight for 60 seconds
- `Vary: Origin`: cache separately for each different origin value

From there, the frontend can now make the actual request:

```
Incoming request: POST /greet
        Host: localhost:5000
        Connection: keep-alive
        Content-Length: 28
        Sec-Ch-Ua-Platform: "Linux"
        User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36
        Sec-Ch-Ua: "Google Chrome";v="141", "Not?A_Brand";v="8", "Chromium";v="141"
        Content-Type: application/json
        Sec-Ch-Ua-Mobile: ?0
        Accept: */*
        Origin: http://localhost:1234
        Sec-Fetch-Site: same-site
        Sec-Fetch-Mode: cors
        Sec-Fetch-Dest: empty
        Referer: http://localhost:1234/
        Accept-Encoding: gzip, deflate, br, zstd
        Accept-Language: en-US,en;q=0.9
```

Most headers are the same as the preflight, with these additions:

- `Content-Length: 28`: size of request body (JSON payload) in bytes
- `Content-Type: application/json`: type of data sent

And the server provides the response:

```
Outgoing response: 200 OK
        Content-Type: application/json
        Content-Length: 85
        Access-Control-Allow-Origin: http://localhost:1234
        Vary: Origin
```

- `Content-Type: application/json`: response contains JSON
- `Content-Length: 85`: size of response body
- `Access-Control-Allow-Origin: http://localhost:1234`: CORS, allow JavaScript
  to read this response
- `Vary: Origin`: cache separately per origin

Since the preflight response can be cached for 60 seconds, if I reload the
webpage immediately, it doesn't send a preflight request, instead it just sends
the POST request directly
