SELECT
  NET.HOST(page) AS pageHost,
  MIN(page) AS pageUrl,
  MIN(url) AS requestUrl,
  COUNT(url) AS requestCount,
  RAND() AS randomSortKey
FROM
  `httparchive.sample_data.requests_mobile_10k`
WHERE
  page IS NOT NULL
  AND page != ''
--INSERT ENTITY QUERY HERE--
GROUP BY
  pageHost
ORDER BY
  randomSortKey DESC
LIMIT
  1000
