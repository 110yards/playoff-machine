
import argparse
from datetime import datetime, timezone
import json

import requests

def get_from_api(url: str, key: str) -> dict:
    response = requests.get(url, headers={"Authorization": key})
    
    if not response.ok:
        print(f"Failed to get data from {url}")
        print(f"Status code: {response.status_code}")
        exit(1)

    return response.json()


def schedule(endpoint: str, key: str):
    print("Downloading schedule")
    path = "schedule"


    url = f"{endpoint}/{path}"

    data = get_from_api(url, key)

    games = data["games"]

    # week = {week_number, first_game, last_game}
    weeks = {}

    # for game in game, capture week number and update first or last game for that week
    for game in games:
        week = game["week"]
        if week not in weeks:
            weeks[week] = {"week": week, "first_game": game["date_start"], "last_game": game["date_start"]}
        else:
            weeks[week]["last_game"] = game["date_start"]
    
    # write json to ./data/weeks.json
    with open(f"data/weeks.json", "w") as f:
        f.write(json.dumps(weeks, indent=4)) 

def update_data(endpoint: str, key: str):
    with open("data/weeks.json", "r") as f:
        weeks = json.load(f)

    # get the current date
    current_date = datetime.now(tz=timezone.utc)

    last_week = 0

    for week_number in weeks:
        # if current_date > week end, update week_number until current_date < week end
        # parse iso
        last_game = datetime.fromisoformat(weeks[week_number]["last_game"])

        if current_date > last_game:
            last_week = week_number
        else:
            break

    # if week_number is 0, no games have been played yet
    if week_number == 0:
        print("No games have been played yet")
        exit(1)

    print(f"Last week: {last_week}")

    year = current_date.year

    path = f"scoreboard?year={year}&week={last_week}"

    data = get_from_api(f"{endpoint}/{path}", key)

    # write to src/assets/js/data/weeks/{week_number}.json
    with open(f"src/assets/js/data/weeks/{last_week}.json", "w") as f:
        f.write(json.dumps(data, indent=4))

    print(f"Updated data for week {last_week}")
    

def main():
    parser = argparse.ArgumentParser(description="Download and process data")
    
    parser.add_argument("--schedule", default=False, action="store_true", help="Download the schedule")
    parser.add_argument("--update", default=False, action="store_true", help="Update the data")
    parser.add_argument("--endpoint", type=str, help="API endpoint", required=True)
    parser.add_argument("--key", type=str, help="API key", required=True)
    
    args = parser.parse_args()

    if args.schedule:
        return schedule(args.endpoint, args.key)
    
    if args.update:
        return update_data(args.endpoint, args.key)
    
    print("No action specified")
    exit(1)



if __name__ == "__main__":
    main()
