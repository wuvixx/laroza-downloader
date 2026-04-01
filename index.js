const fs = require("fs");
const axios = require("axios");
const { decode } = require("html-entities");
const { execSync, spawn } = require("child_process");
const { select, Separator, search } = require("@inquirer/prompts");
const { unpack, decodeFunc2, JuicyCodes } = require("./unpacker");
const ora = require("ora").default;
const transliterate = require("arabic-transliterate");

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36";
const HISTORY_FILE = "./mission_history.json";
const COMMON_HEADERS = {
	'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
	// 'Accept-Encoding': 'gzip, deflate, br, zstd',
	'Accept-Language': 'en-US,en;q=0.9',
	'Cache-Control': 'no-cache',
	'Pragma': 'no-cache',
	'Referer': 'https://larozza.skin/gaza.20', // Note: Referer is case-sensitive in HTTP/1.1, axios will typically send it correctly.
	'Upgrade-Insecure-Requests': '1',
	'User-Agent': USER_AGENT,
};

// Laroza URL changes a lot, so we need to make sure we use the correct referral when we send a request to the embed
let CUR_MIRROR_SITE = "https://larozza.autos/";
let N_M3U8DL1 = "n-m3u8dl-re";
let N_M3U8DL2 = "n_m3u8dl-re";
let N_M3U8DL = undefined;

function checkDependency(name, cmd) {
	try {
		execSync(`${name} ${cmd}`, { stdio: "ignore" });
		return true;
	} catch (e) {
		return false;
	}
}

function getRamadanSeriesFile(unpackedCode) {
	// const [_, file, keyPairs, title] = unpackedCode.match(/const manifest="(.*?)".*drmKey="(.*?)".*title:"(.*?)"/);
	const [_, file, keyPairs, title] = unpackedCode.match(/(https:\/\/mbc.*?)".*"(\w+:\w+)".*title:"(.*?)"/);
	const decodedTitle = title.replace(/\\{1,2}u([\d\w]{4})/gi, (_, grp) => {
		return String.fromCharCode(parseInt(grp, 16));
	});
	return {
		file: file.replaceAll("\\\\/", "/"),
		keyPairs: [keyPairs],
		title: decodedTitle,
	};
}

function getOkprimeFile(unpackedCode) {
	const [_, file] = unpackedCode.match(/file:"(.*?)"/);
	return file;
}

const supportedServers = [
	"ramadan-series.site",
	"vk.com",
	"qq.okprime.site"
];
async function scanLink(link) {
	const url = link.replace("video.php", "play.php");
	const res = await axios.get(url);
	const text = res.data;

	// An array of found & supported servers
	let found = [];

	const urlRegex = text.matchAll(/data-embed-url="(.*?)"/g);
	for (const url of urlRegex) {
		const idx = supportedServers.findIndex(ss => url[1].indexOf(ss) !== -1);
		if (idx !== -1) {
			found.push([idx, url[1].replace("video.php", "play.php")]);
		}
	}

	return found;
}

async function downloadVideo(supportedServerIdx, url) {
	switch (supportedServers[supportedServerIdx]) {
		case supportedServers[0]: // ramadan-series
			{
				// The website is changing a lot... We'll first try the juicy code method
				// Also... Fuck those assholes
				let dean;
				let tryNum = 2; // We have two ways of doing this
				outerLoop:
				while (tryNum) {
					switch (tryNum) {
						case 1: {
							try {
								const juicyCode = await grabRamadanSeriesJuicyCode(url);
								dean = JuicyCodes.Decode(juicyCode);
								break outerLoop;
							} catch (_) {
								tryNum--;
							}
						} break;

						case 2: {
							try {
								const secondCode = await grabRamadan2ndCode(url);
								dean = secondCode;
								break outerLoop;
							} catch (ex) {
								tryNum--;
							}
						} break;
					}
				}

				if (!dean) {
					throw new Error("Could not get our dean... New problem?");
				}

				const { file, keyPairs, title } = getRamadanSeriesFile(unpack(dean));
				try {
					await downloadMPD(supportedServerIdx, file, keyPairs, title);
				} catch (ex) {
					console.log(`❌ Process exited with code ${ex}`);
				}
			}
			break;

		case supportedServers[1]: // vk.com
			{
				const res = await axios.get(url, {
					headers: {
						"User-Agent": USER_AGENT,
					}
				});
				const text = res.data;

				const match = text.match(/(\{"apiPrefetchCache":\[\{.*?\}),\s/);
				if (!match) {
					console.error("❌ Video is unavailable or server is down");
					break;
				}

				const responseJson = JSON.parse(match[1]);
				const item = responseJson.apiPrefetchCache[0].response.items[0];
				const { title } = item;
				const dashUrl = item.files.dash_sep;
				try {
					await downloadMPD(supportedServerIdx, dashUrl, null, decode(title));
				} catch (ex) {
					console.log(`❌ Process exited with code ${ex}`);
				}
			}
			break;

		case supportedServers[2]: // okprime.site
			{
				const res = await axios.get(url, {
					headers: {
						Referer: "https://laroza.hair/",
						Origin: "https://sh.ramadan-series.site",
					}
				});
				const text = res.data;

				const match = text.match(/<title>(.*?)<\/title>[\s\S]+(eval.*)/);
				if (!match) {
					console.error("❌ Couldn't extract pack");
					break;
				}

				const [_, title, fileCode] = match;
				const file = getOkprimeFile(unpack(fileCode));
				try {
					await downloadMPD(supportedServerIdx, file, null, title);
				} catch (ex) {
					console.log(`❌ Process exited with code ${ex}`);
				}
			}
			break;
	}
}

async function getRamadan(url) {
	let tries = 10;
	let res, lastErr;
	while (tries--) {
		try {
			const headers = {
				'Origin': 'https://sh.ramadan-series.site',
				'Referer': CUR_MIRROR_SITE,
				'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
			};
			res = await axios.get(url, { headers });
			lastErr = undefined;
			break;
		} catch (ex) {
			console.error(`❌ Failed to reach server (Tries: ${tries})`);
			lastErr = ex;
		}
	}

	if (lastErr) {
		throw lastErr;
	}

	return res.data;
}

async function grabRamadanSeriesJuicyCode(url) {
	const text = await getRamadan(url);
	const match = text.match(/JuicyCodes\.Run\("(.*?)"\)/);
	if (!match) {
		throw new Error("Juicy code wasn't found");
	}

	const juicyCode = match[1].split(`","`).join("");
	return juicyCode;
}

async function grabRamadan2ndCode(url) {
	const text = await getRamadan(url);
	const match = text.match(/(\[(?:"(?:.*?)",){5,}"(?:.*?)"\]).*_O=(\d+).*_K="(.*?)"/);
	if (!match) {
		throw new Error("2nd code wasn't found");
	}

	const [_, _A, _O, _K] = match;
	const ret = decodeFunc2(JSON.parse(_A), _O, _K);
	return ret;
}

/**
 * 
 * @param {string} mpdUrl - The link to the .mpd manifest
 * @param {string[]?} keyPairs (optional) - Format: "KID:KEY" or ["KID1:KEY1", "KID2:KEY2"]
 * @param {string?} fileName (optional) - Final name for the video
 */
function downloadMPD(supportedServerIdx, mpdUrl, keyPairs, fileName) {
	// Prepare the arguments for the command line
	const args = [
		mpdUrl,
		"--tmp-dir", "Temp",
		"--save-dir", "Downloads",
		"--decryption-engine", "MP4DECRYPT",
		"--auto-select", // Automatically chooses best quality
		"--mux-after-done", "format=mp4:muxer=ffmpeg",
	];

	if (supportedServers[supportedServerIdx] === "qq.okprime.site") {
		args.push(
			"--header", `User-Agent: ${USER_AGENT}`,
			"--header", `Referer: ${supportedServers[supportedServerIdx]}`,
			"--header", `Origin: ${supportedServers[supportedServerIdx]})`,
			"--thread-count", "1",
		);
	}

	if (fileName) {
		args.push("--save-name", fileName);
	}

	if (Array.isArray(keyPairs) && keyPairs.length) {
		args.push(...keyPairs.flatMap(k => ["--key", k]));
	}

	// Clear the console
	// process.stdout.write("\x1Bc");

	const downloader = spawn(N_M3U8DL, args);

	downloader.stdout.on("data", data => {
		// process.stdout.write(data);
		console.log(data.toString());
	});

	downloader.stderr.on("data", data => {
		// process.stderr.write(`\n[ERROR]: ${data}`);
		console.error(`[ERROR]: ${data}`);
	});

	downloader.on("error", err => {
		console.error(err);
	});

	return new Promise((resolve, reject) => {
		downloader.on("close", code => {
			if (code === 0) return resolve();
			reject(code);
		});
	});
}

String.prototype.araToEng = function() {
	return transliterate(this, "arabic2latin", "Arabic");
};

function matchLatestPosts(html) {
	const matches = [
		/<a class="postInner" href="(.*?)" title="(.*?)"/g,
		/div class="thumbnail">.*?href="(.*?)" title="(.*?)"/g
	];
	const results = [];
	for (const match of matches) {
		const ret = html.matchAll(match);
		for (const p of ret) {
			if (results.some(r => r[0] === p[1])) continue;
			results.push([p[1], p[2]]);
		}
	}
	return results;
}

async function getLatestPosts() {
	let tries = 3, lastErr;
	let text;
	while (tries--) {
		try {
			const res = await axios.get(CUR_MIRROR_SITE, {
				headers: COMMON_HEADERS,
			});
			text = res.data;

			let m; // A holder for all matches
			if ((m = text.match(/META HTTP-EQUIV="Refresh".*?URL=(.*?)"/))) {
				CUR_MIRROR_SITE = m[1];
				continue;
			}
			else if ((m = text.match(/div class="home-site-btn-container[\s\S]+?<a href="(.*?)"/))) {
				console.log(`Found a new mirror link: ${m[1]}`);
				CUR_MIRROR_SITE = m[1];
				continue;
			}

			lastErr = undefined;
			break;
		} catch (ex) {
			lastErr = ex;
		}
	}

	if (lastErr) {
		throw lastErr;
	}

	const results = [];
	const matchedPosts = matchLatestPosts(text);
	for (const post of matchedPosts) {
		results.push({ title: post[1].araToEng(), url: post[0] });
	}

	return results;
}

let missionHistory = [];
function saveHistory() {
	fs.writeFileSync(HISTORY_FILE, JSON.stringify(missionHistory, null, 2));
}

function loadHistory() {
	if (fs.existsSync(HISTORY_FILE)) {
		missionHistory = JSON.parse(fs.readFileSync(HISTORY_FILE, "utf-8"));
	}
}

async function mainLoop() {
	for (; ;) {
		const chosenChoice = await select({
			message: "Master, would you like to enter link or search latest posts on Laroza?",
			choices: [
				{
					name: "Link", value: "link"
				},
				{
					name: "Search", value: "search"
				}
			]
		});

		let url;
		for (; ;) {
			let availableOptions;
			if (chosenChoice === "link") {
				const usrInput = await search({
					message: "Master, enter Laroza url:",
					source: async input => {
						if (!input) return [
							...missionHistory.map(url => ({ name: url, value: url })),
							new Separator(),
							{ name: "Go back", value: "back" },
						];

						return [
							{ name: `New URL: ${input}`, value: input },
							...missionHistory
								.filter(url => url.includes(input))
								.map(url => ({ name: url, value: url })),
						];
					},
				});

				if (usrInput === "back") {
					break;
				}

				url = usrInput;
			}
			else if (chosenChoice === "search") {
				const spinner = ora("Loading recent posts...").start();
				let latestPosts;
				try {
					latestPosts = await getLatestPosts();
				} catch (ex) {
					console.error(ex);
					spinner.fail();
					break;
				}
				spinner.succeed();
				const usrInput = await search({
					message: "Master, enter search keyword:",
					source: async input => {
						if (!input) return [
							...latestPosts.map(post => ({ name: post.title, value: post.url })),
							new Separator(),
							{ name: "Go back", value: "back" }
						];

						return latestPosts
							.filter(post => post.title.toLowerCase().includes(input.toLowerCase()))
							.map(post => ({ name: post.title, value: post.url }));
					},
				});

				if (usrInput === "back") {
					break;
				}

				url = usrInput;
			}

			const spinner = ora("Loading servers...").start();
			try {
				availableOptions = await scanLink(url);
				if (!availableOptions.length) {
					// console.error("❌ Error: No servers found");
					spinner.fail("No servers found");
					continue;
				}
				spinner.succeed();
			} catch (ex) {
				spinner.fail("Invalid link");
				// console.error("❌ Error: invalid link");
				continue;
			}

			if (!missionHistory.includes(url)) {
				missionHistory.unshift(url);
				if (missionHistory.length > 10) missionHistory.pop();
			}

			const choices = availableOptions.map((option, idx) => {
				return {
					name: supportedServers[option[0]],
					value: idx
				}
			});

			choices.push(new Separator());
			choices.push({ name: "Go back", value: "cancel" });

			const answer = await select({
				message: "Select a server provider",
				choices
			});

			if (answer === "cancel") {
				continue;
			}

			try {
				await downloadVideo(availableOptions[answer][0], availableOptions[answer][1]);
			} catch (ex) {
				console.error(ex);
			}
		}
	}
}

process.on("uncaughtException", err => {
	if (err.name === "ExitPromptError") {
		saveHistory();
		process.exit();
	}
	console.error(err);
});

process.on("SIGINT", () => {
	saveHistory();
});

if (!checkDependency("ffmpeg", "-version")) {
	console.error("FFmpeg not found! Please install it and add it to your PATH.");
	process.exit(1);
}

if (checkDependency(N_M3U8DL1, "--version")) {
	N_M3U8DL = N_M3U8DL1;
}
else if (checkDependency(N_M3U8DL2, "--version")) {
	N_M3U8DL = N_M3U8DL2;
}
else {
	console.error(`${N_M3U8DL} not found! Please install it and add it to your PATH.`);
	process.exit(2);
}

loadHistory();
mainLoop();
