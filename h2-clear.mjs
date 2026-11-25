import http from "node:http";

const query = "DELETE FROM translation_cache WHERE source_language = 'vi' AND target_language = 'en'";

function request(path, method, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: "localhost", port: 8080, path, method, headers },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
      }
    );
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

const login = await request(
  "/h2-console/login.do",
  "POST",
  "jsessionid=admin&password=&name=sa",
  { "Content-Type": "application/x-www-form-urlencoded" }
);
console.log("login status:", login.status);
const cookie = login.headers["set-cookie"];
console.log("cookie:", cookie ? cookie[0].split(";")[0] : "none");

const sessionId = cookie ? cookie[0].split("=")[1].split(";")[0] : "";

const exec = await request(
  "/h2-console/do",
  "POST",
  new URLSearchParams({ jsessionid: sessionId, sql: query }).toString(),
  {
    "Content-Type": "application/x-www-form-urlencoded",
    Cookie: `JSESSIONID=${sessionId}`,
  }
);
console.log("exec status:", exec.status);
console.log(exec.body.slice(0, 600));
