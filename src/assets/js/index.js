
// const teams = {
//     "BC": { name: "BC", wins: 0, losses: 0, ties: 0, pointsFor: 0, pointsAgainst: 0, standingsPoints: 0 },
//     "CGY": { name: "CGY", wins: 0, losses: 0, ties: 0, pointsFor: 0, pointsAgainst: 0, standingsPoints: 0 },
//     "EDM": { name: "EDM", wins: 0, losses: 0, ties: 0, pointsFor: 0, pointsAgainst: 0, standingsPoints: 0 },
//     "HAM": { name: "HAM", wins: 0, losses: 0, ties: 0, pointsFor: 0, pointsAgainst: 0, standingsPoints: 0 },
//     "MTL": { name: "MTL", wins: 0, losses: 0, ties: 0, pointsFor: 0, pointsAgainst: 0, standingsPoints: 0 },
//     "OTT": { name: "OTT", wins: 0, losses: 0, ties: 0, pointsFor: 0, pointsAgainst: 0, standingsPoints: 0 },
//     "SSK": { name: "SSK", wins: 0, losses: 0, ties: 0, pointsFor: 0, pointsAgainst: 0, standingsPoints: 0 },
//     "TOR": { name: "TOR", wins: 0, losses: 0, ties: 0, pointsFor: 0, pointsAgainst: 0, standingsPoints: 0 },
//     "WPG": { name: "WPG", wins: 0, losses: 0, ties: 0, pointsFor: 0, pointsAgainst: 0, standingsPoints: 0 },
// }

const westTeams = ["BC", "CGY", "EDM", "SSK", "WPG"]
const eastTeams = ["HAM", "MTL", "OTT", "TOR"]


export const loadData = async () => {
    const response = await fetch('assets/js/data/schedule.json');

    const schedule = await response.json();

    const weekNumbers = schedule.games.map(game => game.week).filter((value, index, self) => self.indexOf(value) === index);

    const games = [];

    for (const weekNumber of weekNumbers) {
        const response = await fetch(`assets/js/data/weeks/${weekNumber}.json`);

        // skip if week data is not available
        if (!response.ok) {
            continue;
        }

        console.debug(`Processing week: ${weekNumber}`);

        const weekData = await response.json();

        if (!weekData.games) {
            console.debug(`No scores for week ${weekNumber}`);

            // add future games from schedule
            let gamesForWeek = schedule.games.filter(game => game.week === weekNumber);
            gamesForWeek = gamesForWeek.map(game => ({
                id: game.game_id,
                date: new Date(game.date_start).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
                home: game.home.abbr,
                homeScore: null,
                away: game.away.abbr,
                awayScore: null,
                winner: null,
                future: true,
            }));

            games.push(...gamesForWeek);
            continue;
        }

        for (const game of weekData.games) {
            const gameStatus = game.game_status.status_id;

            console.debug(`Processing game: ${game.home.abbr} vs ${game.away.abbr} - ${gameStatus}`);

            games.push({
                id: game.game_id,
                date: new Date(game.date_start).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
                home: game.home.abbr,
                homeScore: game.home_score,
                away: game.away.abbr,
                awayScore: game.away_score,
                winner: game.winner,
                future: false,
            });



        }
    }

    // map game id to games
    const gamesMap = games.reduce((acc, game) => {
        acc[game.id] = game;
        return acc;
    }, {});

    // for each team, confirm the calculated standings points match the check points
    // for (const team of Object.values(teams)) {
    //     if (team.standingsPoints !== team.checkPoints) {
    //         console.error(`Standings points mismatch for team ${team.name}: ${team.standingsPoints} vs ${team.checkPoints}`);
    //     }
    // }


    return {
        season: schedule.year,
        west,
        east,
        games: gamesMap,
    }
}

export const calcStandingsPoints = (team) => {
    return team.wins * 2 + team.ties
}

export const calculateStandings = (games) => {
    console.debug(games)

    const allTeams = [...westTeams, ...eastTeams]

    const teams = allTeams.map(team => ({
        name: team,
        wins: 0,
        losses: 0,
        ties: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        standingsPoints: 0,
        divisionWinner: false,
        makesPlayoffs: false,
        isCrossover: false
    })).reduce((acc, team) => {
        acc[team.name] = team
        return acc
    }, {});

    for (const game of games) {
        // update team stats
        const home = game.home
        const away = game.away
        const homeScore = game.homeScore
        const awayScore = game.awayScore

        if (game.future && game.winner != null) {
            console.log(`Forcasting game: ${home} vs ${away} - Winner = ${game.winner}`);
            if (game.winner === home) {
                teams[home].wins += 1
                teams[away].losses += 1
            } else if (game.winner === away) {
                teams[away].wins += 1
                teams[home].losses += 1
            } else {
                teams[home].ties += 1
                teams[away].ties += 1
            }
        } else {

            console.debug(`Processing completed game: ${home} vs ${away} - ${homeScore} - ${awayScore}`);

            teams[home].pointsFor += homeScore
            teams[home].pointsAgainst += awayScore
            teams[away].pointsFor += awayScore
            teams[away].pointsAgainst += homeScore

            if (game.winner === "home") {
                teams[home].wins += 1
                teams[away].losses += 1
            } else if (game.winner === "away") {
                teams[away].wins += 1
                teams[home].losses += 1
            } else if (game.winner === "tie") {
                teams[home].ties += 1
                teams[away].ties += 1
            }
        }

        teams[home].standingsPoints = calcStandingsPoints(teams[home])
        teams[away].standingsPoints = calcStandingsPoints(teams[away])
    }

    const west = westTeams.map(team => teams[team]).sort((a, b) => b.standingsPoints - a.standingsPoints)
    const east = eastTeams.map(team => teams[team]).sort((a, b) => b.standingsPoints - a.standingsPoints)

    west[0].divisionWinner = true
    east[0].divisionWinner = true

    // second teams make it
    west[1].makesPlayoffs = true
    east[1].makesPlayoffs = true

    // assume no crossover first
    west[2].makesPlayoffs = true
    east[2].makesPlayoffs = true

    // if 4th in one division has more points than 3rd in the other, then crossover
    if (west[3].standingsPoints > east[2].standingsPoints) {
        west[3].isCrossover = true
        east[2].makesPlayoffs = false
    } else if (east[3].standingsPoints > west[2].standingsPoints) {
        east[3].isCrossover = true
        west[2].makesPlayoffs = false
    }

    return {
        west,
        east,
    }

}
