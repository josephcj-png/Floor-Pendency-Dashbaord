"""Trial run of the HOV image query outside Apps Script.

Setup (once):
    pip install google-cloud-bigquery
    gcloud auth application-default login      # sign in with the Google account that runs the dashboard

Usage:
    python tools/hov_query_test.py                      # access check + dry run (no cost) + tiny sample
    python tools/hov_query_test.py AWB1 AWB2 ...        # also look up these AWBs
"""
import re
import sys

from google.cloud import bigquery

PROJECT = "data-warehousing-391512"  # same as BQ_PROJECT in Code.gs


def query_for(awbs):
    lst = ",".join("'" + re.sub(r"[^A-Za-z0-9_\-]", "", a) + "'" for a in awbs)
    return f"""SELECT manifests_item.awb_number, STRING_AGG(DISTINCT ai.image_url, ' ; ') AS sorter_image, STRING_AGG(DISTINCT ai1.image_url, ' ; ') AS muvro_image
FROM `data-warehousing-391512.ecommerce.manifests_item` manifests_item
LEFT JOIN `data-warehousing-391512.ecommerce.awb_awbimages` ai ON ai.awb_number = manifests_item.dsp_awb_number AND ai.created >= CURRENT_DATE() - INTERVAL 90 DAY
LEFT JOIN `data-warehousing-391512.ecommerce.awb_awbimages` ai1 ON ai1.awb_number = manifests_item.awb_number AND ai1.created >= CURRENT_DATE() - INTERVAL 90 DAY
WHERE manifests_item.created >= CURRENT_DATE() - INTERVAL 90 DAY AND manifests_item.awb_number IN ({lst})
GROUP BY manifests_item.awb_number"""


def main():
    client = bigquery.Client(project=PROJECT)
    print("1. Access: running SELECT 1 in project", PROJECT)
    print("   ok:", list(client.query("SELECT 1 AS ok").result())[0].ok == 1)

    awbs = sys.argv[1:] or ["TEST_AWB_0001"]
    sql = query_for(awbs)

    print("2. Dry run (validates table access + permissions, bills nothing)")
    job = client.query(sql, job_config=bigquery.QueryJobConfig(dry_run=True, use_query_cache=False))
    print(f"   would scan {job.total_bytes_processed / 1e9:.2f} GB")

    print("3. Real run for", len(awbs), "AWB(s)")
    rows = list(client.query(sql).result())
    print("   rows returned:", len(rows))
    for r in rows[:10]:
        print("  ", r.awb_number, "| sorter:", bool(r.sorter_image), "| muvro:", bool(r.muvro_image))


if __name__ == "__main__":
    main()
