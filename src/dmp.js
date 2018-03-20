#!/home/liqingjht/mybin/node
const inquirer = require('inquirer');
const simpleParser = require("mailparser").simpleParser;
const autocomplete = require('inquirer-autocomplete-prompt');
const chalk = require("chalk");
const ProgressBar = require("progress");
const nodeSSH = require('node-ssh');
const fs = require("fs");
const path = require("path");
const readline = require("readline");
const pk = require("./package.json");
const crypto = require("crypto");
const {execSync} = require("child_process");

const ssh = new nodeSSH();
const cwd = process.cwd();
const secret = `-|${pk.author}|-`;
const ignores = ["bugzilla-daemon", "mailer-daemon"];

const q = process.exit;
const l = console.log;
const e = (...msg) => {l(chalk.red(msg.join('\n')))}
const help = () => {
	let msg = `  dmp usages:
	
	-r [--reset] 'reset username and password'

	-p [--parseMail] 'parse mail to ascii patch, but not raw mail'

	author: ${pk.author}

	version: ${pk.version}`
	l(msg);
	q();
}

let mf = "./mailFolder/";
let cf = "./.configuration";
let tmp = "./temp/";
let db = "./.datebase";

[mf, cf, tmp, db] = handleDirname(mf, cf, tmp, db);

const invalidArgv = ["-r", "--reset", "-p", "--parseMail"];
const argv = process.argv.slice(2);
let reset = false;
let parseMail = false;
for(let i=0; i<argv.length; i++) {
	let opt = argv[i];
	if(invalidArgv.includes(opt) === false) {
		help();
		q();
	}
	if(invalidArgv.indexOf(opt) < 2) {
		reset = true;
	}
	else {
		parseMail = true;
	}
}

let [needQues, user, passwd] = [true];
if(reset === false) {
	try {
		let data = fs.readFileSync(cf, "utf-8");
		let {username, password} = JSON.parse(decode(data));
		if(username === undefined || username.trim() === "" || password === undefined || password.trim() === "") {
			throw new Error();
		}
		user = username;
		passwd = password;
		needQues = false;
	}
	catch(err) {
		needQues = true;
	}
}
else {
	try {
		fs.writeFileSync(cf, encode("{}"), "utf-8");
	}
	catch(err) {
		e(err.message);
		q();
	}
}

(async function() {
	if(needQues) {
		let {username} = await inquirer.prompt({
			name: "username",
			message: "What's your dniserver username?"
		})

		let {password} = await inquirer.prompt({
			name: "password",
			type: "password",
			message: "What's your dniserver password?"
		})

		user = username;
		passwd = password;

		try {
			let obj = {username, password}
			fs.writeFileSync(cf, encode(JSON.stringify(obj)), "utf-8");
		}
		catch(err) {
			e("Occur error when store username and password");
		}
	}

	try {
		await ssh.connect({
			host: 'dniserver.dnish.net',
			username: user,
			password: passwd
		})

		let result = await ssh.execCommand('ls', { cwd: `/home/${user}/Maildir/cur/`});
		if(result.code !== 0) {
			e(result.stderr);
			q();
		}
		let files = result.stdout.split("\n");

		result = await ssh.execCommand('ls', { cwd: '/mailman/archives/private/'});
		if(result.code !== 0) {
			e(result.stderr);
			q();
		}
		let mailboxes = result.stdout.split("\n");
		mailboxes = mailboxes.filter(m => !m.endsWith(".mbox"));

		let down = [];
		let exist = fs.readdirSync(mf);
		let len = files.length;
		for(let i=0; i<len; i++) {
			let v = files[i];
			if(exist.includes(v) === false) {
				down.push(v);
			}
		}

		len = exist.length;
		for(let i=0; i<len; i++) {
			let v= exist[i];
			if(files.includes(v) === false) {
				fs.unlink(path.join(mf, v), err => {/*do nothing*/})
			}
		}

		len = down.length;
		progressBar = new ProgressBar(`Syncing With Server: ${chalk.cyan(':current')}/${chalk.yellow(':total')} :percent [:etas]`, {
			curr: 0,
			total: len,
			clear: false
		});
		for(let i=0; i<len; i++) {
			try {
				await ssh.getFile(path.join(mf, down[i]), `/home/${user}/Maildir/cur/${down[i]}`);
				progressBar.tick();
			}
			catch(err) {
				l(down[i])
				e(err.message);
				q();
			}
		}

		await ssh.dispose();

		let mails = fs.readdirSync(mf);
		mails = mails.filter(mail => {return !mail.startsWith(".")})
		let mailList = await Promise.all(mails.map(file => {
			return new Promise(async function(resolve, reject) {
				let [found, data] = await head(path.join(mf, file));
				if(found === false) {l(file)
					resolve({file, from: ignores[0]});
					return;
				}
				simpleParser(data, (error, mail) => {
					if(error) {
						e(err.message);
						e(patch.join(mf, file));
						resolve({file, from: ignores[0]});
						//reject(error);
					}
					else {
						let {subject, from, to, date} = mail;
						if(isUndefined(subject, from ,to, date)) {
							resolve({file, from: ignores[0]});
							return;
						}
						from = from.value[0].address.replace(/^(.*?)@.*$/, "$1").toLowerCase();
						let [err, toAddr] = handleReceiveBox(mailboxes, to);
						if(err) {
							resolve({file, from: ignores[0]});
							return;
						}
						to = toAddr
						if(subject.trim().startsWith("Re:")) {
							resolve({file, from: ignores[0]});
							return;
						}
						subject = handleSubject(subject);
						resolve({file, subject, from, to, date});
					}
				});
			})
		}))

		let all = {};
		len = mailList.length;
		let maxLength = -1;
		for(let i=0; i<len; i++) {
			let one = mailList[i];
			let {file, subject, from, to, date} = one;
			if(ignores.includes(from)) {
				continue;
			}
			if(all[to] === undefined) {
				all[to] = [];
			}
			date = (new Date(date)).getTime();
			if(from.length > maxLength) {
				maxLength = from.length;
			}
			all[to].push({file, subject, from, date});
		}

		let tos = Object.keys(all);
		len = tos.length;
		for(let i=0; i<len; i++) {
			all[tos[i]].sort((a, b) => {
				return b.date - a.date;
			})
		}

		inquirer.registerPrompt('autocomplete', autocomplete);

		let toSource = Object.keys(all);
		toSource.sort();
		let perIndex = toSource.indexOf("Personal-Mail");
		if(perIndex !== -1) {
			toSource.splice(perIndex, 1);
			toSource.push("Personal-Mail");
		}

		let {selTo} = await inquirer.prompt({
			type: 'autocomplete',
			name: 'selTo',
			message: "search or select the email sent to: ",
			pageSize: 20,
			paginated: true,
			choices: toSource,
			source: (answers, input) => {
				return searchFunc(toSource, input);
			}
		})

		let patches = all[selTo];
		len = patches.length;
		for(i=0; i<len; i++) {
			let {file, subject, from, date} = patches[i];
			let t = new Date(date);
			//let year = Number(t.getFullYear()).toString().slice(-2);
			let [mon, day, hour, minute, second] = handleNumberFormat(t.getMonth() + 1, t.getDate(), t.getHours(), t.getMinutes(), t.getSeconds());
			let sendDate = `${mon}-${day} ${hour}:${minute}:${second}`
			from = from.padEnd(maxLength, " ");
			let sub = handleSubject(subject, true);

			patches[i] = {
				"name": `${sendDate} | ${from} | ${subject}`,
				"value": {file, sub}
			}
		}

		patches.unshift(new inquirer.Separator(chalk.yellow("\n >>>>>-----------------------------<<<<<\n")));

		var {selPatches} = await inquirer.prompt({
			type: 'checkbox',
			name: 'selPatches',
			message: "Select some patches to download: ",
			pageSize: 20,
			paginated: true,
			choices: patches,
		})

		len = selPatches.length;
		selPatches.reverse();
		let patchIdx = 1;
		for(let i=0; i<len; i++) {
			try {
				let {file, sub} = selPatches[i];
				let name = handleSaveName(sub, parseMail? 'patch': 'eml');
				name = Number(patchIdx).toString().padStart(4, "0") + "-" + name;
				let savePath = path.join(cwd, `./${name}`);
				let fromPath = path.join(mf, `./${file}`);
				if(parseMail === false) {
					execSync(`cp "${fromPath}" "${savePath}"`);
				}
				else {
					try {
						let out = execSync(`git-mailinfo msg patch <"${fromPath}"`, {'cwd': tmp});
						let lines = out.toString().split('\n');
						let keys = ['Author', 'Email', 'Subject', 'Date'];
						let vals = Array(4);
						for(let i=0; i<lines.length; i++) {
							let each = lines[i].trim().split(':');
							if(each.length < 2)
								continue;
							let key = each[0].trim();
							let val = each.slice(1).join(':').trim();
							let index = keys.indexOf(key);
							if(index === -1)
								continue;
							vals[index] = val;
						}
						if(isUndefined(vals)) {
							throw new Error();
						}

						let author = vals[0].replace(/^"(.*?)"$/, "$1");
						let saver = `From: ${author} <${vals[1]}>\n`;
						saver += `Date: ${vals[3]}\n`;
						saver += `Subject: ${vals[2]}\n\n`;

						fs.writeFileSync(path.join(tmp, 'info'), saver, 'utf-8');
						execSync(`cat info msg patch >result; cp result "${savePath}"`, {'cwd': tmp});
						execSync(`cp result "${savePath}"`, {'cwd': tmp});
					}
					catch(parseErr) {
						savePath = savePath.replace(/^(.*\/[^\/]+)\.patch$/, '$1.eml');
						execSync(`cp "${fromPath}" "${savePath}"`);
						l(chalk.yellow(`>>> ${name}`));
						patchIdx ++;
						continue;
					}
				}
				patchIdx ++;
				l(chalk.green(`>>> ${name}`));
			
			}
			catch(err) {
				e(err.message);
			}
		}
	}
	catch(err) {
		e(err.message);
		q();
	}
}) ()

function head(file) {
	return new Promise((resolve, reject) => {
		let rl = readline.createInterface({
			input: fs.createReadStream(file),
			crlfDelay: Infinity
		});

		let arr = [];

		rl.on("line", (line) => {
			arr.push(line);
			line = line.trim();
			if(line.startsWith("Sender") || line === "") {
				let header = arr.join('' + '\n');
				resolve([true, header]);
				rl.close();
			}
		})

		rl.on("close", () => {
			resolve([false]);
		})
	})
}

function encode(str) {
	var cipher = crypto.createCipher('aes192', secret);
	var enc = cipher.update(str, 'utf8', 'hex');
	enc += cipher.final('hex');
	return enc;
}

function decode(str) {
	var decipher = crypto.createDecipher('aes192', secret);
	var dec = decipher.update(str, 'hex', 'utf8');
	dec += decipher.final('utf8');
	return dec;
}

function searchFunc(source, input) {
	return new Promise((resolve, reject) => {
		if(input ===  null) {
			resolve(source);
			return;
		}

		let len = source.length;
		let values = [];
		for(i=0; i<len; i++) {
			if(source[i].toLowerCase().indexOf(input.toLowerCase()) !== -1) {
				values.push(source[i]);
			}
		}
		resolve(values);
	})
}

function handleSubject(subject, removePatch) {
	subject = subject.replace(/[\s\t]{1,}/g, " ").trim();
	subject = subject.replace(/^(\[.+?\]\s*)+?(\[PATCH(\s\d+\/\d+)?\])(.+)$/, "$2$4").trim();
	if(removePatch === true)
		subject = subject.replace(/^(\[PATCH( \d+\/\d+)?\])(.+)$/, "$3");
	else
		subject = subject.replace(/^(\[PATCH\])(.+)$/, "$2");
	return subject.trim();
}

function handleSaveName(name, ext) {
	name = name.replace(/[^\-a-zA-Z0-9_.]/g, " ");
	name = name.trim();
	name = name.replace(/[\s\t]{1,}/g, "-");
	name = name.replace(/-{2,}/g, "-");
	name = name.slice(0, 70);
	name = name + (name.endsWith(".")? ext: `.${ext}`);
	return name;
}

function isUndefined(...rest) {
	for(let i=0; i<rest.length; i++) {
		if(rest[i] === undefined) {
			return true;
		}
	}
	return false;
}

function handleReceiveBox(mailboxes, to) {
	let v = [];
	if(Array.isArray(to)) {
		for(let i=0; i<to.length; i++) {
			v.concat(to[i].value);
		}
	}
	else {
		v = to.value;
	}
	let len = v.length;
	if(len === 0) {
		return [true];
	}
	else if(len === 1) {
		let addr = v[0].address.replace(/^(.*?)@.*$/, "$1").toLowerCase();
		return [false, mailboxes.includes(addr)? addr: "Personal-Mail"];
	}
	else {
		let toProject = false;
		for(let i=0; i<v.length; i++) {
			let addr = v[i].address.replace(/^(.*?)@.*$/, "$1").toLowerCase();
			if(mailboxes.includes(addr)) {
				return [false, addr];
			}
		}
		return [true];
	}
}

function handleNumberFormat(...rest) {
	for(let i=0; i<rest.length; i++) {
		rest[i] = Number(rest[i]).toString().padStart(2, "0");
	}
	return rest;
}

function handleDirname(...rest) {
	for(let i=0; i<rest.length; i++) {
		rest[i] = path.join(__dirname, rest[i]);
	}
	return rest;
}
