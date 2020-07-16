SELECT
  NET.HOST(page) AS pageHost,
  MIN(page) AS pageUrl,
  MIN(url) AS requestUrl,
  COUNT(url) AS requestCount
FROM
  `httparchive.sample_data.requests_mobile_10k`
WHERE
  page IS NOT NULL
  AND page != ''
--INSERT ENTITY QUERY HERE--
GROUP BY
  pageHost
ORDER BY
  requestCount DESC
LIMIT
  1000
