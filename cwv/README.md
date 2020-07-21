# Usage

1. Install dependencies, Run `yarn`
1. Find URL lists for each entity.
   1. Create the `pages-for-entity.gen.sql` file, Run `node bigquery/generate-query-and-megadataset.js`.
   1. Run the query with each entity separately (individually comment back in each entity before running).
   1. Download the "JSON (local up to 16,000 rows)" output from each query and commit as a file at `bigquery/datasets/<entity>-urls.json`
1. Create machine profiles to run.
   1. Create the `megadataset.gen.json` file, Run `node bigquery/generate-query-and-megadataset.js` now that the `<entity>-urls.json` files are available.
1. Spin up machines and start the collection.
   1. (Prerequiste) Install GCloud SDK and authenticate locally, Run `brew cask install google-cloud-sdk && gcloud auth login`
   1. (Optional) Edit `NUMBER_OF_RUNS` and `CLOUDSDK_CORE_PROJECT` in `collection/create-and-run.sh` as desired.
   1. (Optional) Edit `URLS_PER_MACHINE` in `collection/create-script-fleet.js` as desired.
   1. Run `bash collection/fleet-create.sh`
1. Check status of collection, download data, and kill machines on completion.
   1. Run `bash collection/fleet-status.sh` to get status of each instance and download if done.
   1. Run `bash collection/fleet-status.sh --kill` to get status of each instance and download+kill if done.
1. Analyze the results
   1. Run `bash analyze/preprocess.sh` to extract the results from tar archives.
   1. Run `node analyze/analyze-ab-test.js > results.csv` to dump the data into a CSV.
