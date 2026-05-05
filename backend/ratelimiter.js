const rateLimitMap = new Map();

const WINDOW_SIZE = 60 * 1000; // 1 minute
const MAX_REQUESTS = 10;

function rateLimiter(req, res, next) {
  const ip = req.ip;
  const currentTime = Date.now();

  if (!rateLimitMap.has(ip)) {
    rateLimitMap.set(ip, { count: 1, startTime: currentTime });
    return next();
  }

  const data = rateLimitMap.get(ip);

  if (currentTime - data.startTime < WINDOW_SIZE) {
    data.count++;

    if (data.count > MAX_REQUESTS) {
      return res.status(429).json({
        error: "Too many requests. Try again later.",
      });
    }
  } else {
    rateLimitMap.set(ip, { count: 1, startTime: currentTime });
  }

  next();
}

module.exports = rateLimiter; // ✅ important
