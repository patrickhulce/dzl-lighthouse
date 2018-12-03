#!/bin/bash


mysql -u dzl -plighthouse dzl_lighthouse << "EOF"

DELETE FROM data_points
WHERE label LIKE '%continuous%' AND
(type != 'metric' AND name != 'timing-total') AND
batchTime <= DATE_SUB(DATE(NOW()), INTERVAL 1 DAY);

DELETE FROM data_points
WHERE label = 'official-ci' AND
(type != 'metric' AND name != 'timing-total') AND
batchTime <= DATE_SUB(DATE(NOW()), INTERVAL 7 DAY);

EOF
