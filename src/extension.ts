import * as vscode from 'vscode';
import axios from 'axios';
import fs from 'fs';
import * as path from 'path';
import fsPromises from 'fs/promises';
import { exec } from 'child_process';
import { yamale, ansibleYAMLLint } from './annotations.js';
import { workflows, indexDataRAG, retrieveAndGenerateRAGWorkflow, retrieveAndGenerateRAGGeneral, fetchREADMEFiles } from './rag.js';
import { fileURLToPath } from 'url';

// global state variables shared across extension functions
// exported variables are used across files for annotations, RAG logic, and sequential tasks/playbooks
export let workflow = "";
export let validation_schema = "";
export let validation_schema_file = "";
export let playbook = "";
export let sequentialTasks = false;
export let sequentialPlaybooks: string[] = [];
let initializationPromiseRAG: Promise<void> | null = null;
let lastGitHubCloneCheck = new Date(0);

// initialized variable for user's virtual environment path 
let env = { ...process.env };

/**
 * Activates the extension: starts env setup (creates venv, installs dependencies, automates generation of settings.json), registers chat participant & commands, and starts RAG initialization.
 * Executed only after the extension is activated.
 */
export async function activate(context: vscode.ExtensionContext) {
	console.log("NaC AI Copilot extension activated!");

	// register chat participant 
	const participant = vscode.chat.createChatParticipant('chat-tutorial.code-assistant', handler);
	context.subscriptions.push(participant);

	// register command to check Yamale, YAMLlint, and Ansible Lint syntax
	const validateAndLint = vscode.commands.registerTextEditorCommand(
		'validate-and-lint',
		async (textEditor: vscode.TextEditor) => {
			// wait for envSetup to complete before running validation and linting
			await checkSetupAutomation();

			// send message to user that validation is in progress
			vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: "Validating code. Please wait...",
				cancellable: false
			}, async () => {
				const yamaleOutput = await yamale(true, "", textEditor);
				await ansibleYAMLLint(true, "", textEditor);
				if (yamaleOutput[0] === "true") {
					// display success message to user 
					vscode.window.showInformationMessage(yamaleOutput[1]);
				}
			});
		}
	);
	context.subscriptions.push(validateAndLint);

	// register command to run playbook on open vars file
	const runPlaybook = vscode.commands.registerTextEditorCommand(
		'run-playbook',
		async(textEditor: vscode.TextEditor) => {
			// wait for envSetup to complete before running playbook
			await checkSetupAutomation();

			// send message to user that Ansible playbook is being run
			vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: "Running Ansible playbook. Please wait...",
				cancellable: false
			}, async () => {
				await runAnsiblePlaybook(textEditor);
			});
		}
	);
	context.subscriptions.push(runPlaybook);

	// initialize RAG approach in the background
	initializationPromiseRAG = initializeRAG();
}

/**
 * Checks whether setup has been automted already (venv created, dependencies installed, settings.json generated).
 * If not, and a new project has been created, automates the setup process again.
 */
async function checkSetupAutomation() {
	// check whether all dependencies have been installed
	const requiredDependencies = [
        'ansible',
        'ansible-runner',
        'yamale',
        'ansible-lint',
        'yamllint'
    ]
	const missingDependencies: string[] = [];

	// find appropraite command based on Windows vs. macOS/Linux platform
	const cmd = process.platform === 'win32' ? 'where' : 'which';

	// loop through required dependencies and check if they are installed using terminal "where" command
	for (const d of requiredDependencies) {
		await new Promise<void>((resolve, reject) => {
			exec(`${cmd} ${d}`, { env }, (error: any, stdout: string, stderr: string) => {
				if (error) {
					console.error(`Error retrieving path of dependency ${d}: ${error.message}`);
					missingDependencies.push(d);
				}
				resolve();
			});
		});
	}

	// check if python environment has not been created or dependencies have not been installed
	if (!fs.existsSync(`${vscode.workspace.rootPath}/python3env`) || missingDependencies.length > 0) {
		// send message to user that environment setup is in progress
		vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: "Setting up environment. Please wait...",
			cancellable: false
		}, async () => {
			// automate venv creation, dependency installation, and settings.json generation
			await envSetup();

			// add relevant NaC folders/files to user's workspace
			await createNaCFiles();
		});
	}
}

/**
 * Sets up the virtual environment for the extension, installs necessary dependencies, and generates settings.json file accordingly.
 * Automates entire process using exec() function calls to run terminal commands.
 */
async function envSetup() {
	// create virtual environment
	await new Promise<void>((resolve, reject) => {
		exec(`python3 -m venv ${vscode.workspace.rootPath}/python3env --prompt nac-venv`, (error, stdout, stderr) => {
			if (error) {
				console.error(`Error creating virtual environment: ${error.message}`);
				vscode.window.showErrorMessage(`Failed to create virtual environment. Please ensure Python 3 is installed and try creating it manually.`);
			}
			console.log(`Virtual environment created: ${stdout}`);
			resolve();
		});
	});

	// activate virtual environment
	await new Promise<void>((resolve, reject) => {
		exec(`source ${vscode.workspace.rootPath}/python3env/bin/activate`, (error, stdout, stderr) => {
			if (error) {
				console.error(`Error activating virtual environment: ${error.message}`);
				vscode.window.showErrorMessage(`Failed to activate virtual environment. Please ensure Python 3 is installed and try activating it manually.`);
			}
			console.log(`Virtual environment activated: ${stdout}`);
			resolve();
		});
	});

	// retrieve user's virtual environment path & set environment variables for terminal commands 
	env = { ...process.env };
	env.PATH = `${vscode.workspace.rootPath}/python3env/bin:${env.PATH}`;
	env.VIRTUAL_ENV = `${vscode.workspace.rootPath}/python3env`;

	// install dependencies using pip
	await new Promise<void>((resolve, reject) => {
		exec(`pip install ansible ansible-runner dnacentersdk yamale ansible-lint yamllint jinja2`, { env }, (error, stdout, stderr) => {
			if (error) {
				console.error(`Error installing dependencies: ${error.message}`);
				vscode.window.showErrorMessage(`Failed to install dependencies. Please ensure Python 3 is installed and try installing them manually.`);
			}
			console.log(`Dependencies installed: ${stdout}`);
			resolve();
		});
	});

	// clone dnacenter-ansible repository 
	await new Promise<void>((resolve, reject) => {
		exec(`ansible-galaxy collection install cisco.dnac --force`, { env }, (error, stdout, stderr) => {
			if (error) {
				console.error(`Error cloning dnacenter-ansible repository: ${error.message}`);
				vscode.window.showErrorMessage(`Failed to clone dnacenter-ansible repository. Please ensure Python 3 is installed and try cloning it manually.`);
			}
			console.log(`dnacenter-ansible repository cloned: ${stdout}`);
			resolve();
		});
	});

	// set the ANSIBLE_PYTHON_INTERPRETER variable
	await new Promise<void>((resolve, reject) => {
		exec(`export ANSIBLE_PYTHON_INTERPRETER=$(which python)`, { env }, (error, stdout, stderr) => {
			if (error) {
				console.error(`Error setting ANSIBLE_PYTHON_INTERPRETER: ${error.message}`);
				vscode.window.showErrorMessage(`Failed to set ANSIBLE_PYTHON_INTERPRETER. Please ensure Python 3 is installed and try setting it manually.`);
			}
			console.log(`ANSIBLE_PYTHON_INTERPRETER set: ${stdout}`);
			resolve();
		});
	});

	// automate generation of settings.json file 
	const settingsFilePath = `${vscode.workspace.rootPath}/.vscode/settings.json`;

	// settings.json file content - retrieve the path to the ansible-lint, yamale, yamllint, git, ansible-playbook, and venv executables
	const settingsContent = {
		"nac-copilot.ansibleLintPath": await getDependencyPath('ansible-lint'),
		"nac-copilot.yamalePath": await getDependencyPath('yamale'),
		"nac-copilot.yamlLintPath": await getDependencyPath('yamllint'),
		"nac-copilot.gitPath": await getDependencyPath('git'),
		"nac-copilot.ansiblePlaybookPath": await getDependencyPath('ansible-playbook'),
		"nac-copilot.venv": await getDependencyPath('python3env'),
	};

	// write contents to settings.json file
	if (!fs.existsSync(`${vscode.workspace.rootPath}/.vscode`)) {
		await fsPromises.mkdir(`${vscode.workspace.rootPath}/.vscode`, { recursive: true });
	}
	fs.writeFileSync(settingsFilePath, JSON.stringify(settingsContent, null, 4), 'utf8');
}

/**
 * Finds the dependency path of the specified dependency using the terminal command "where" or "which".
 * Returns the dependency path as a string.
 */
async function getDependencyPath(dependency: string): Promise<string> {
	// find appropriate command based on Windows vs. macOS/Linux platform
	const cmd = process.platform === 'win32' ? 'where' : 'which';
	let dependencyPath = "";

	if (dependency === 'python3env') {
		await new Promise<void>((resolve, reject) => {
			exec(`echo $VIRTUAL_ENV`, { env }, (error: any, stdout: string, stderr: string) => {
				if (error) {
					vscode.window.showErrorMessage(`Please install this dependency: ${dependency}. Also, make sure to update your settings.json file with this installation.`);
					resolve();
				}
				dependencyPath = stdout.trim();
				resolve();
			});
		});
	} else {
		await new Promise<void>((resolve, reject) => {
			exec(`${cmd} ${dependency}`, { env }, (error: any, stdout: string, stderr: string) => {
				if (error) {
					vscode.window.showErrorMessage(`Please install this dependency: ${dependency}. Also, make sure to update your settings.json file with this installation.`);
					resolve();
				}
				dependencyPath = stdout.trim();
				resolve();
			});
		});
	}

	return dependencyPath.toString();
}

/**
 * Creates relevant folders and files in user's workspace to organize project structure (mirrors NaC GitHub repository structure).
 * Files include inventory, data, and usecase maps.
 */
async function createNaCFiles() {
	// create inventory folder and empty hosts.yml file
	const hostsFilePath = `${vscode.workspace.rootPath}/ansible_inventory/catalystcenter_inventory/hosts.yaml`;
	const hostsContent = `
	---
	catalyst_center_hosts:
		hosts:
			catalyst_center220:
				#(Mandatory) CatC Ip address
				catalyst_center_host:  <DNAC IP Address>
				#(Mandatory) CatC UI admin Password
				catalyst_center_password: <DNAC UI admin Password>
				catalyst_center_port: 443
				catalyst_center_timeout: 60
				#(Mandatory) CatC UI admin username
				catalyst_center_username: <DNAC UI admin username> 
				catalyst_center_verify: false
				#(Mandatory) DNAC Release version
				catalyst_center_version: <DNAC Release version>
				catalyst_center_debug: true
				catalyst_center_log_level: INFO
				catalyst_center_log: true
				#(Optional) Python interpreter path, use this cli to find the path in your virtual environment:
				# python -c "import sys; print(sys.executable)"
				ansible_python_interpreter: <your python interpreter path>
	`;

	// create inventory directory if it doesn't exist 
	if (!fs.existsSync(`${vscode.workspace.rootPath}/ansible_inventory/catalystcenter_inventory`)) {
		await fsPromises.mkdir(`${vscode.workspace.rootPath}/ansible_inventory/catalystcenter_inventory`, { recursive: true });
	}

	// copy file contents to hosts.yaml file
	await fsPromises.writeFile(hostsFilePath, hostsContent.trim(), 'utf8');

	// create empty data & data_deletion folders
	if (!fs.existsSync(`${vscode.workspace.rootPath}/data`)) {
		await fsPromises.mkdir(`${vscode.workspace.rootPath}/data`, { recursive: true });
	}
	if (!fs.existsSync(`${vscode.workspace.rootPath}/data_deletion`)) {
		await fsPromises.mkdir(`${vscode.workspace.rootPath}/data_deletion`, { recursive: true });
	}

	// create empty usecase_maps folder
	if (!fs.existsSync(`${vscode.workspace.rootPath}/usecase_maps`)) {
		await fsPromises.mkdir(`${vscode.workspace.rootPath}/usecase_maps`, { recursive: true });
	}
}

/**
 * Initializes RAG approach: clones GitHub repo (as needed), fetches README files, & generates RAG embeddings for vector DB.
 */
async function initializeRAG() {
	console.log("RAG initialization started...");

	// clone GitHub repo if any files are missing
	await cloneGitHubRepo();
	
	// fetch README files from cloned GitHub repo
	await fetchREADMEFiles();

	// chunk, embed & store README files in vector DB
	await indexDataRAG();
}

/**
 * Runs Ansible playbook on vars file open in text editor: retrieves hosts.yml, playbook, and vars file paths to run ansible-playbook command.
 */
async function runAnsiblePlaybook(textEditor: vscode.TextEditor) {
	// get ansible-playbook path from settings.json configuration
	const ansiblePlaybookPath = vscode.workspace.getConfiguration('nac-copilot').get<string>('ansiblePlaybookPath');

	// ask user to enter hosts, playbook, and vars file paths 
	const hostsFilePath = await pickFile('Select your hosts file');
	console.log(`Hosts file path selected: ${hostsFilePath}`);
	// ensure hosts file path is valid
	if (!hostsFilePath) {
		return;
	} 
	const playbookFilePath = await pickFile('Select your playbook file', true);
	console.log(`Playbook file path selected: ${playbookFilePath}`);
	// ensure playbook file path is valid
	if (!playbookFilePath) {
		return;
	} 
	const varsFilePath = await pickFile('Select your vars file');
	console.log(`Vars file path selected: ${varsFilePath}`);
	// ensure vars file path is valid
	if (!varsFilePath) {
		return;
	} 

	// retrieve name of playbook file from its absolute path
	const playbookRun = playbookFilePath.split("/").pop();

	// create output channel to display important Ansible playbook results to the user
	const outputChannel = vscode.window.createOutputChannel('Ansible Playbook Output');
	outputChannel.show(true);
	outputChannel.appendLine(`Running playbook: ${playbookRun} with vars file: ${varsFilePath}\n`);

	// get CatC log file path from cloned GitHub repo in user's workspace
	let catcLogPath = "";
	const logURIs = await vscode.workspace.findFiles(`**/workflows/${workflow}/playbook/dnac_log.log`);
	if (logURIs.length === 0) {
		catcLogPath = `${vscode.workspace.rootPath}/ai-assistant-catalyst-center-ansible-iac/workflows/${workflow}/playbook/dnac_log.log`;
	} else {
		const logFileNames = logURIs.map(uri => uri.fsPath);
		catcLogPath = logFileNames[0];
	}

	// create Ansible log file (replace if already exists)
	const ansibleLogPath = catcLogPath.replace(/dnac_log\.log$/, 'ansible_log.log');
	if (await fs.existsSync(ansibleLogPath)) {
		await fs.unlinkSync(ansibleLogPath); 
	} 
	await fsPromises.mkdir(path.dirname(ansibleLogPath), { recursive: true });

	// run ansible-playbook terminal command on vars file
	const startTime = new Date();
	outputChannel.appendLine(`Start time: ${startTime.toLocaleString()}\n`);
	await new Promise<void>((resolve, reject) => {
		exec(`"${ansiblePlaybookPath}" -i "${hostsFilePath}" "${playbookFilePath}" --extra-vars "@${varsFilePath}" -vvv`, { env }, async (error: any, stdout: string, stderr: string) => {
			const endTime = new Date();
			const duration = ((endTime.getTime() - startTime.getTime()) / 1000).toFixed(3); 

			// write output to Ansible log file
			fs.writeFileSync(ansibleLogPath, `--- STDOUT ---\n${stdout}\n--- STDERR ---\n${stderr}`);

			// append all output to output channel
			outputChannel.appendLine(`--- STDOUT ---\n${stdout}`);

			// notify user if playbook run failed or succeeded
			if (error) {
				// if errors present, notify user that playbook run failed 
				if (error) {
					outputChannel.appendLine(`--- ERROR ---\n${error.message}`);
				} else {
					outputChannel.appendLine(`--- STDERR ---\n${stderr}`);
				}
				vscode.window.showErrorMessage(`Playbook execution failed ❌`);
			} else {
				// else notify user that playbook run was successful
				vscode.window.showInformationMessage(`Playbook execution successful! 👍`);
			} 

			outputChannel.appendLine(`End time: ${endTime.toLocaleString()}`);
			outputChannel.appendLine(`Execution time: ${duration} seconds\n`);
			outputChannel.appendLine(`Check the logs for more details:\n`);
			outputChannel.appendLine(`Ansible log: ${ansibleLogPath}`);
			outputChannel.appendLine(`CatC log: ${catcLogPath}`);
			resolve();
		});
	});
}

/**
 * Displays quick pick menu to user to select a YAML or YML file from their workspace.
 * Returns the absolute path of the selected file or undefined if no file was selected.
 */
async function pickFile(placeholder: string, isPlaybook: boolean = false): Promise<string | undefined> {
	// list of uris for YAML and YML files in user's workspace
	let uris = [
		...await vscode.workspace.findFiles(`**/*.yaml`),
		...await vscode.workspace.findFiles(`**/*.yml`),
	];

	// remove all unnecessary file paths from selection (listed below)
	// paths that include venv file path (retrieve from settings.json) and .vscode directories
	const venvPath = vscode.workspace.getConfiguration('nac-copilot').get<string>('venv');
	if (venvPath) {
		uris = uris.filter(uri => !uri.fsPath.includes(venvPath));
	}
	uris = uris.filter(uri => !uri.fsPath.includes('.vscode'));

	// if playbook selection, restrict to playbook files only
	// else remove paths that include ai-assistant-catalyst-center-ansible-iac (if not playbook selection)
	if (isPlaybook) {
		uris = uris.filter(uri => uri.fsPath.includes('playbook'));
	} else {
		uris = uris.filter(uri => !uri.fsPath.includes('ai-assistant-catalyst-center-ansible-iac'));
	}

	// account for case where no YAML or YML files are found in user's workspace
	if (uris.length === 0) {
		vscode.window.showErrorMessage(`No YAML or YML files found.`);
		return undefined;
	}

	// map each file to a label of the name of the file and a description of the absolute path
	const files = uris.map(uri => ({
		label: vscode.workspace.asRelativePath(uri).split('/').pop() || uri.fsPath,
		description: vscode.workspace.asRelativePath(uri),
		fullPath: uri.fsPath
	}));

	// show quick pick menu to user with file options for them to select
	const pickedFile = await vscode.window.showQuickPick(files, {
		placeHolder: placeholder,
		matchOnDescription: true
	});

	// return absolute path of selected file or undefined if no file was selected
	return pickedFile ? pickedFile.fullPath : undefined;
}

/**
 * Identifies workflow to use based on user's request using RAG.
 * Returns identified workflow as a string.
 */
async function identifyWorkflow(request: vscode.ChatRequest, token: vscode.CancellationToken, prompt: string): Promise<string> {
	console.log("Identifying workflow for user's request...");
	let identifiedWorkflow = "";

	// embeds user query, performs similarity search to retrieve top chunks, & identifies relevant workflow
	identifiedWorkflow = await retrieveAndGenerateRAGWorkflow(prompt, 10, request, token);
	return identifiedWorkflow.toLowerCase().trim();
}

/**
 * Finds playbook for user's request based on identified workflow.
 * Returns name of identified playbook file as a string.
 */
async function identifyPlaybook(request: vscode.ChatRequest, token: vscode.CancellationToken): Promise<string> {
	console.log("Searching for playbooks...");
	// based on workflow selected, search for names of all playbooks in cloned GitHub repo
	const playbooks = [];
	const uris = await vscode.workspace.findFiles(`**/ai-assistant-catalyst-center-ansible-iac/workflows/${workflow}/playbook/*`);
	const fileNames = uris.map(uri => uri.fsPath);

	for (const f of fileNames) {
		playbooks.push(f);
	}

	let p = '';
	console.log(`Playbooks found (${playbooks.length}): `, playbooks);

	// if multiple playbooks found, identify which to use based on user's request
	if (playbooks.length > 1) {
		// prompt model to select playbook based on user's request 
		const PLAYBOOK_SELECTION_PROMPT = `You are a helpful assistant. Your job is to select the appropriate playbook to use for the user's request based on the playbook file names provided. 
		You should just provide the file name of the playbook to use as a string. Keep in mind that words like "delete" or "remove" often relate to playbooks with "delete" in the name.
		Here is an example of a response you would generate: delete_ise_radius_integration_workflow_playbook.yml
		\nThe available playbooks are: ${playbooks.join(',')} \n
		Here is the user prompt: \n
		${request.prompt}`;

		const messages = [vscode.LanguageModelChatMessage.User(PLAYBOOK_SELECTION_PROMPT)];

		// send request to Copilot LLM model
		try {
			const chatResponse = await request.model.sendRequest(messages, {}, token);
			let data = '';
			for await (const fragment of chatResponse.text) {
				data += fragment;
			}
			// trim whitespace from response
			p = data.trim();
		} catch (error) {
			console.error("Error identifying playbook using Copilot LLM model: ", error);
			return '';
		}
	} else {
		// if only 1 playbook found, use that for user's request
		p = playbooks[0];
	}

	// remove path to playbook and just return the file name
	return p.replace(/.*playbook\//, "");
}

/**
 * Finds validation schema for user's request based on identified workflow.
 * Returns content of validation schema file as a string.
 */
export async function selectValidationSchema(workflow: string): Promise<string> {
	console.log(`Searching for validation schema for workflow ${workflow}...`);
	// search for validation schema in cloned GitHub repo
	const uris = await vscode.workspace.findFiles(`**/ai-assistant-catalyst-center-ansible-iac/workflows/${workflow}/schema/*_schema.yml`);
	let fileNames = uris.map(uri => uri.fsPath);

	// if playbook includes "delete", schema should include "delete" in name
	if (fileNames.length > 1 && playbook.includes('delete')) {
		fileNames = fileNames.filter(file => file.includes('delete'));
	} else {
		fileNames = fileNames.filter(file => !file.includes('delete'));
	}
	

	// get name of validation schema file
	if (fileNames.length !== 0 && fileNames[0]) {
		validation_schema_file = fileNames[0].replace(/.*schema\//, "");
	} else {
		validation_schema_file = "";
		return "";
	}

	console.log("Validation schema file identified: ", validation_schema_file);

	// read & return content of validation schema file
	try {
		const schemaContent = await fsPromises.readFile(fileNames[0], 'utf8');
		return schemaContent;
	} catch (error) {
		console.error("Error reading validation schema file: ", error);
		return '';
	}
}

/**
 * Retrieves sample vars files for user's request based on identified workflow.
 * If singular is true, only returns 1 vars file based on playbook name, else returns all vars files as examples.
 */
export async function getVarsFiles(workflow: string, singular: boolean = false, playbook: string = ''): Promise<String> {
	console.log(`Searching for vars file(s) for workflow ${workflow}...`);

	const varsFiles = [];
	// based on workflow selected, search for names of all sample vars files in cloned GitHub repo (either ends with "_inputs.yml" or "_vars.yml")
	const uriVals = await vscode.workspace.findFiles(`**/ai-assistant-catalyst-center-ansible-iac/workflows/${workflow}/vars/*.yml`);
	const files = uriVals.map(uri => uri.fsPath);

	for (const f of files) {
		varsFiles.push(f);
	}

	console.log(`Vars files found: (${varsFiles.length})`, varsFiles);

	// retrieve content from sample vars files
	let i = 1;
	let varsFileExamples = '';
	for (const file of varsFiles) {
		// if singular, only return 1 sample vars file based on playbook name
		if (singular) {
			// delete in playbook name, delete should be in sample vars file name OR if no jinja in playbook name, no jinja should be in sample vars file name
			if (playbook.includes('delete') && file.includes('delete') || !playbook.includes('jinja') && !file.includes('jinja')) {
				varsFileExamples += `Example ${i}: `;

				let fileContent = '';
				try {
					fileContent = await fsPromises.readFile(file, 'utf8');
				} catch (error) {
					console.error("Error reading sample vars file: ", error);
				}
				return fileContent;
			}
		} else {
			// if not singular, return all sample vars files formatted as examples for LLM
			varsFileExamples += `Example ${i}: `;

			let fileContent = '';
			try {
				fileContent = await fsPromises.readFile(file, 'utf8');
			} catch (error) {
				console.error("Error reading sample vars file: ", error);
			}

			varsFileExamples += fileContent;
			i += 1;
		}
	}

	return varsFileExamples;
}

/**
 * Clones GitHub repository if it has been updated since last clone by checking commit hashes.
 * Returns true if repo was cloned, false otherwise.
 */
async function cloneGitHubRepo(): Promise<boolean> {
	let githubCommitHash = ``;
	let repoCommitHash = '';
	let clonedRepo = false;
	let repoExists = false;

	// update lastGitHubCloneCheck to current date
	lastGitHubCloneCheck = new Date();

	// git dependency path to clone repo & retrieve commit hash of cloned repo as needed
	const gitPath = vscode.workspace.getConfiguration('nac-copilot').get<string>('gitPath');

	// check if cloned GitHub repo exists in user's workspace
	const clonedRepoPath = `${vscode.workspace.rootPath}/ai-assistant-catalyst-center-ansible-iac`;
	if (fs.existsSync(clonedRepoPath)) {
		repoExists = true;

		// get latest commit hash of GitHub repo main branch
		const apiURL = `https://api.github.com/repos/cisco-en-programmability/catalyst-center-ansible-iac/git/trees/main`;
		try {
			const response = await axios.get(apiURL, {
				headers: { 
					'Accept': 'application/vnd.github.v3+json'
				},
			});
			githubCommitHash = response.data.sha;
		} catch (error){
			console.error("Error retrieving latest commit hash of GitHub repository: ", error);
		}

		try {
			await new Promise<void>((resolve, reject) => {
				exec(`${gitPath} -C "${clonedRepoPath}" rev-parse HEAD`, (error: any, stdout: string, stderr: string) => {
					if (error) {
						console.error(`Error retrieving commit hash of cloned repository: ${error.message}`);
						reject(error);
						return;
					}
					repoCommitHash = stdout.trim();
					resolve();
				});
			});
		} catch (error) {
			console.error("Error retrieving commit hash of cloned repository: ", error);
		}
	}

	console.log(`GitHub commit hash: ${githubCommitHash} VS cloned repository commit hash: ${repoCommitHash}`);

	// check if repo does not exist or GitHub commit hash is different from cloned repo commit hash 
	if (!repoExists || githubCommitHash !== repoCommitHash) {
		// clone GitHub repo to user's VSCode workspace again 
		clonedRepo = true;
		console.log("GitHub repository has been updated. Cloning repository again...");
		let repoURL = `https://github.com/cisco-en-programmability/catalyst-center-ansible-iac.git`;
		const destDir = `${vscode.workspace.rootPath}/ai-assistant-catalyst-center-ansible-iac`;

		// check if destination directory exists in user's workspace
		if (fs.existsSync(destDir)) {
			// remove destination directory
			fs.rmSync(destDir, { recursive: true, force: true });
		}

		// terminal command to clone GitHub repo to destination directory
		await new Promise<void>((resolve, reject) => {
			exec(`"${gitPath}" clone ${repoURL} "${destDir}"`, (error: any, stdout: string, stderr: string) => {
				if (error) {
					console.error(`Error cloning repository: ${error.message}`);
					if (stderr) {
						reject(error);
						console.error(stderr);
						return;
					}
				}
				console.log(`Repository cloned successfully: ${stdout}`);
				resolve();
			});
			// exit function after cloning repository 
			return;
		});
	}

	return clonedRepo;
}

/**
 * Handles chat requests from the user.
 * Initializes RAG (as needed), clones GitHub repo (as needed), and handles chat assistant (@assistant) with commands (/ask, /validate).
 */
const handler: vscode.ChatRequestHandler = async (
	request: vscode.ChatRequest,
	context: vscode.ChatContext,
	stream: vscode.ChatResponseStream,
	token: vscode.CancellationToken,
) => {
	// check whether environment setup has been automated in this project already
	await checkSetupAutomation();

	// wait for initializeRAG() function to complete
	if (initializationPromiseRAG) {
		// send message to user that RAG initialization is in progress
		vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: "Initializing RAG approach. Please wait...",
			cancellable: false
		}, async () => {
			await initializationPromiseRAG;
			// wait 3 additional seconds for steps below to complete
			await new Promise(resolve => setTimeout(resolve, 3000));
		});
		await initializationPromiseRAG;
		initializationPromiseRAG = null;
	}

	// re-clone repo if needed on a bi-weekly basis
	const currentDate = new Date();
	let clonedRepo = false;
	if (currentDate.getTime() - lastGitHubCloneCheck.getTime() > 14 * 24 * 60 * 60 * 1000) {
		clonedRepo = await cloneGitHubRepo();
	}

	if (clonedRepo) {
		console.log("GitHub repository has been cloned. Proceeding with RAG initialization...");

		// send message to user that repo cloning is in progress
		vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: "Cloning GitHub repository for updated files. Please wait...",
			cancellable: false
		}, async () => {
			// fetch README files from newly cloned GitHub repo
			await fetchREADMEFiles();

			// generate RAG embeddings
			await indexDataRAG();

			// wait 3 additional seconds for steps below to complete
			await new Promise(resolve => setTimeout(resolve, 3000));
		});
	} else {
		console.log("GitHub repository has not been cloned.");
	}

	// check if command is for asking questions, validating YAML code, or identifying playbook for task
	if (request.command === 'ask') {
		// get response from RAG approach
		const llmResponse = await retrieveAndGenerateRAGGeneral(request.prompt, 10, request, token);
		stream.markdown(llmResponse);
	} else if (request.command === 'validate') {
		// if sequential tasks have been identified, provide playbook options to user (to identify validation schema)
		let valPath = "";
		if (sequentialTasks) {
			// add steps to sequential playbooks to make it easier for user to identify
			for (let i = 0; i < sequentialPlaybooks.length; i++) {
				if (!sequentialPlaybooks[i].includes("Step")) {
					sequentialPlaybooks[i] = `Step ${i + 1}: ${sequentialPlaybooks[i]}`;
				}
			}
	
			// create quick pick menu to allow user to select a playbook for validation
			const selectedPlaybook = await vscode.window.showQuickPick(sequentialPlaybooks, {
				placeHolder: "Select a playbook to validate your vars file against",
				matchOnDescription: true
			});
	
			// retrieve full playbook path to identify workflow
			const formattedPlaybook = selectedPlaybook ? selectedPlaybook.replace(/Step \d+: /, '') : '';
			const playbookUri = await vscode.workspace.findFiles(`**/ai-assistant-catalyst-center-ansible-iac/**/playbook/${formattedPlaybook}`);
			const fullPlaybookPath = playbookUri[0].fsPath;
			const taskWorkflow = fullPlaybookPath.split('/workflows/')[1].split('/')[0];
	
			// identify validation schema file and content based on user selection
			const uris = await vscode.workspace.findFiles(`**/ai-assistant-catalyst-center-ansible-iac/workflows/${taskWorkflow}/schema/*_schema.yml`);
			let fileNames = uris.map(uri => uri.fsPath);

			// if playbook includes "delete", schema should include "delete" in name
			if (fileNames.length > 1 && formattedPlaybook.includes('delete')) {
				fileNames = fileNames.filter(file => file.includes('delete'));
			} else {
				fileNames = fileNames.filter(file => !file.includes('delete'));
			}

			if (fileNames.length !== 0 && fileNames[0]) {
				valPath = fileNames[0];
			}
		}

		// save user's code to temporary file on disk
		const userCode = request.prompt;
		const tempFilePath = `${vscode.workspace.rootPath}/temp_vars_file.yml`;
		try {
			await fsPromises.writeFile(tempFilePath, userCode, 'utf8');
		} catch (error) {
			console.error("Error writing to temporary file for validation: ", error);
			return;
		}

		let yamaleOutput = "";
		let yamllintOutput = "";
		let ansibleLintOutput = "";

		// if workflow & validation_schema identified, run Yamale
		if ((workflow && valPath) || (workflow && validation_schema)) {
			const textEditor = vscode.window.activeTextEditor;
			if (textEditor) {
				const yamaleReturn = await yamale(false, tempFilePath, textEditor, valPath);
				yamaleOutput = yamaleReturn[1];
			} else {
				const yamaleReturn = await yamale(false, tempFilePath);
				yamaleOutput = yamaleReturn[1];
			}
		} 

		// run YAMLlint & Ansible Lint
		const textEditor = vscode.window.activeTextEditor;
		if (textEditor) {
			const lintOutputs = await ansibleYAMLLint(false, tempFilePath, textEditor);
			ansibleLintOutput = lintOutputs[0];
			yamllintOutput = lintOutputs[1];
		} else {
			const lintOutputs = await ansibleYAMLLint(false, tempFilePath);
			ansibleLintOutput = lintOutputs[0];
			yamllintOutput = lintOutputs[1];
		}

		console.log(`\nAnsible Lint output: ${ansibleLintOutput}\n
		YAMLlint output: ${yamllintOutput}\n
		Yamale output: ${yamaleOutput}\n`);

		// delete temporary file after validation 
		try {
			await fsPromises.unlink(tempFilePath);
		} catch (error) {
			console.error("Error deleting temporary file for validation: ", error);
			return;
		}

		// send linting & validation suggestions to Copilot LLM model to generate chat response
		let PROMPT = `You are a helpful assistant. Your job is to help the user validate their YAML code by providing them with how to improve their code if it fails validation or a success message if validation is successful.
		You may provide specific suggestions to improve the user's code based on the validation results from Yamale, YAMLlint, and Ansible Lint. Only provide 1 suggestion per error as needed.
		When providing specific code suggestions, make sure to format the code in a code block with the language specified as YAML.
		To help you with this, here are the validation results from running yamale, yamllint, & ansible-lint on the user's code:
		Yamale: \n${yamaleOutput}\n
		YAMLlint: \n${yamllintOutput}\n
		Ansible Lint: \n${ansibleLintOutput}\n
		At the end, if there are any errors, provide the user with the fixed code in a code block with the language specified as YAML.
		Finally, here is the user's YAML code that is being validated: \n${userCode}\n`;

		// if workflow & validation schema not identified, notify user to identify playbook first (using @assistant chat participant)
		if (!((workflow && valPath) || workflow && validation_schema)) {
			PROMPT += `Notify the user BEFORE FIXED CODE IN THE RESPONSE to identify the playbook first in order to use Yamale validation using the \`\`\`@assistant\`\`\` chat feature to identify the appropriate playbook for their task.\n
			MAKE SURE TO SPELL the following with proper camel case: Yamale, YAMLlint, Ansible Lint.
			Here is an example of a response you would generate:\n
			"Your YAML code is well formatted and passes validation with YAMLlint and Ansible Lint!\n\n
			However, to use Yamale validation, you need to identify the playbook or schema that matches your task. 
			Please provide the \`\`\`@assistant\`\`\` chat feature with your request to identify the appropriate playbook for your task."
			<Code block with fixed YAML code>`;
		}

		const messages = [vscode.LanguageModelChatMessage.User(PROMPT)];

		// send request to Copilot LLM model
		try {
			const chatResponse = await request.model.sendRequest(messages, {}, token);
			for await (const fragment of chatResponse.text) {
				stream.markdown(fragment);
			}
		} catch (error) {
			console.error("Error generating valid code using Copilot LLM model: ", error);
		}
		return;
	} else {
		// handle sequencing of tasks for multiple vars files & playbooks
		sequentialTasks = false;

		// retrieve content from usecase maps
		const __dirname = path.dirname(fileURLToPath(import.meta.url));
		const root = path.resolve(__dirname, '..');

		const day0_discovery = await fsPromises.readFile(path.join(root, 'day0_discovery.yml'), 'utf8');
		const day1_provisioning = await fsPromises.readFile(path.join(root, 'day1_provisioning.yml'), 'utf8');
		const dayN_operations = await fsPromises.readFile(path.join(root, 'dayN_operations.yml'), 'utf8');
		const dayN_removal = await fsPromises.readFile(path.join(root, 'dayN_removal.yml'), 'utf8');

		// LLM prompt to identify whether user's prompt is referring to using a singular playbook or sequence of utilizing multiple playbooks; utilizes NaC usecase mapping as context 
		let prompt = `Your job is to analyze the user's prompt and break it into a list of distinct tasks, where each task corresponds to a specific playbook or workflow needed to fulfill the user's request.
		- Only split the prompt if the user's request clearly requires multiple workflows or playbooks.
		- If the entire prompt relates to a single workflow, return a single-item list containing the whole prompt.
		- Do NOT split the prompt into individual words or phrases that do not represent complete tasks.
		- Each item in the list should be a full sentence or phrase describing a specific task or workflow.
		- IMPORTANT: Return your answer as a JSON array of strings. Each string should be a complete task corresponding to a workflow, not a singular word.

		Here are the available workflows: ${workflows.join(', ')}.

		Here are some examples of how to split prompts:\n

		Example 1:
		Prompt: "Create 5 buildings in Australia site and 1 floor per building"
		Output: ["Create 5 buildings in Australia site and 1 floor per building"]

		Example 2:
		Prompt: "Create a new site in Hawaii and upgrade devices in the site to the latest software version"
		Output: ["Create a new site in Hawaii", "upgrade devices in the site to the latest software version"]

		Example 3:
		Prompt: "Add users to the network and configure device credentials"
		Output: ["Add users to the network", "configure device credentials"]
		\n

		Here are some additional examples where playbooks / workflows are used in succession for an idea of common usecases and ordering.
		IMPORTANT: Use these examples to reorder the user's prompt into a sequence of correctly ordered tasks. Double check the list of tasks against these examples to make sure they make sense in succession. If the tasks don't make sense in comparison to these examples, use these examples to identify the correct order of tasks.
		IMPORTANT: Use logic to also see if the ordering needs to be changed. For instance, sites cannot be used later if they have not been created, so create sites first before doing other steps that require sites. Another example is that devices must be discovered before being provisioned or added to anything like inventory or configurations.
		IMPORTANT: If a step is creating, finding, or discovering something that is referenced in another step, make sure to perform this step of creation, finding, or discovering before the step that references it. So fix the ordering if this is the case.
		MAKE SURE you return a JSON array of strings, where each string is a task IN THE CORRECT ORDER.
		Each comment section corresponds to a successive task using a different playbook / workflow:
		\n Example 1:
		${day0_discovery}
		\n

		\n Example 2:
		${day1_provisioning}
		\n

		\n Example 3:
		${dayN_operations}
		\n

		\n Example 4:
		${dayN_removal}
		\n

		Now, split the following prompt from the user accordingly:
		${request.prompt}
		`;

		const messages = [vscode.LanguageModelChatMessage.User(prompt)];
		let separatedPrompts = [];

		// send request to Copilot LLM model
		try {
			const chatResponse = await request.model.sendRequest(messages, {}, token);
			let response = "";
			for await (const line of chatResponse.text) {
				response += line;
			}

			// parse response as JSON array
			try {
				separatedPrompts = JSON.parse(response);
			} catch (error) {
				console.error("Error parsing response as JSON: ", error);
				// if response is not valid JSON, notify user to try again with a different prompt
				stream.markdown("Failed to retrieve information from model. Please try again.");
				return;
			}
		} catch (error) {
			console.error("Error generating valid code using Copilot LLM model: ", error);
		}

		// group together consecutive tasks with the same playbook
		const taskDescriptions: string[] = [];
		const taskWorkflows: string[] = [];
		const taskValidationSchemas: string[] = [];
		const taskPlaybooks: string[] = [];
		const taskPlaybookPaths: string[] = [];
		const taskVarsFiles: String[] = [];

		// iterate through each task in the separated prompts to identify workflow, validation schema, playbook, and example vars files
		let previousPlaybook = "";
		for (const task of separatedPrompts) {
			// identify workflow to use based on task
			workflow = await identifyWorkflow(request, token, task);
			if (!workflows.includes(workflow)) {
				stream.markdown("Failed to retrieve information from model. Please try again.");
				return;
			}

			// identify playbook to use based on workflow & task
			const taskPlaybook = await identifyPlaybook(request, token);
			playbook = taskPlaybook;

			// fetch validation schema for the vars file based on workflow selected
			const taskValSchema = await selectValidationSchema(workflow);

			// search for vars files in extension files (cloned GitHub repo)
			const varsFiles = await getVarsFiles(workflow, true, taskPlaybook);

			// if previous playbook is not empty and is same as the current playbook, combine task descriptions
			if (previousPlaybook !== "" && previousPlaybook === taskPlaybook) {
				taskDescriptions[taskDescriptions.length - 1] += `and ${task}`;
			} else {
				// if previous playbook is different, update lists with new task data
				taskDescriptions.push(task);
				taskWorkflows.push(workflow);
				taskValidationSchemas.push(taskValSchema);
				taskPlaybooks.push(taskPlaybook);
				taskPlaybookPaths.push(`https://github.com/cisco-en-programmability/catalyst-center-ansible-iac/blob/main/workflows/${workflow}/playbook/${taskPlaybook}`);
				taskVarsFiles.push(varsFiles);

				// update previous playbook to current playbook
				previousPlaybook = taskPlaybook;
			}
		}

		// iterate through all task data & populate formatted data for LLM prompt to generate vars files per task
		let taskData = "";
		for (let i = 0; i < taskDescriptions.length; i++) {
			// update formatted data for prompt with new task
			taskData += `\n\n\n**TASK ${i}**\n`;
			taskData += `Task Description: ${taskDescriptions[i]}\n`;
			taskData += `Workflow: ${taskWorkflows[i]}\n`;
			taskData += `Validation Schema: ${taskValidationSchemas[i]}\n`;
			taskData += `Playbook: \`${taskPlaybooks[i]}\`\n`;
			taskData += `Playbook Path: https://github.com/cisco-en-programmability/catalyst-center-ansible-iac/blob/main/workflows/${taskWorkflows[i]}/playbook/${taskPlaybooks[i]}\n`;
			taskData += `Vars File Examples:\n${taskVarsFiles[i]}\n`;
		}

		// if identified playbooks are all the same, do not separate prompt into tasks
		if (taskPlaybooks.length === 1) {
			separatedPrompts = [request.prompt];
		} else {
			console.log("Multiple playbooks identified for user's request: ", taskPlaybooks);
			sequentialTasks = true;
			sequentialPlaybooks = taskPlaybooks
		}

		// if multiple playbooks, break user prompt into sequence of steps & generate vars file for each individual step 
		// NOTE: pass in user's request to generateVarsFile() function 
		if (separatedPrompts.length > 1) {
			const SEQUENCE_VARS_PROMPT = `You are a helpful code assistant. Your job is to provide the user with YAML code for specific workflows in Catalyst Center. 
			DO NOT provide the user with ANY Jinja code unless they specify. Just keep it simple and provide the user with YAML code that is properly indented and formatted.
			
			Here is an example of what you should do:
			* Example: User types 'create a new site in Catalyst Center named "Branch-01" in area "West"', you suggest appropriate Catalyst Center Ansible/Terraform models and playbooks with syntax. Let user interact further to accurately define their Network as Code YAML data models.
			
			The user's prompt includes multiple tasks that need to be performed in succession. We have identified the playbooks to use for each of the user's tasks.
			NOTE: Any variables the 'vars:' section of the playbook SHOULD NOT be included as variables in the vars file you generate.

			From this, we also retrieved the appropriate schema YAML files for validation that the vars file must follow, once again for each of the user's tasks.
			If a variable is included in the vars file, make sure to include ALL required variables under that variable from the validation schema provided. 
			To know whether a field is required, check the validation schema for required=True in the field definition.
			Using this and the user's prompt, generate code for a vars file that follows the schema, is properly indented with good coding principles, and follows what the user asks for. 

			For each of the user's tasks, please format the playbook name as inline code to make it more readable. Make sure to include the link to the playbook for each task in your response.
			Make sure to include this line at the very end: Use the "Validate & Lint" feature after you have finished writing your vars file in order to check that it meets the appropriate standards.
			We also identified some examples of the proper format for the YAML code you should be generating for with proper indentation, fields, and syntax for this specific workflow, corresponding to each of the user's tasks:

			Make sure to format each of the vars files as YAML code blocks with the language specified as YAML. Include "---" at the start of each code block to indicate the start of the YAML file.
			Also, add a newline at the end of each code block to ensure proper linting and formatting.

			IMPORTANT: DO NOT include any variables in a specific vars file that are not present in the corresponding validation schema file provided. DO NOT include any commented variables from the validation schema in the generated vars file code.
			Also, follow the INDENTATION and SYNTAX of the example vars files provided above (DO NOT USE ANYTHING ELSE for indentation formatting).

			Each task should include the identified playbook, link to the playbook, and YAML code for that task's vars file. START the response for each task with "STEP X: TITLE" where X is the task number and TITLE is a short 3-5 word task description.
			Make this text stand out by using bold formatting, a larger font size (if possible), and a horizontal line to separate each task.

			IMPORTANT: Make sure to use the proper identified playbook and link to the playbook for each task. LIST IT PROPERLY in the response. DO NOT specify the workflow in the response.

			Here is a sample response you would generate: \n

			**STEP 1: Encrypt SNMP Community String**

			You should use the \`ansible_vault_update_playbook.yml\` playbook to encrypt and store the SNMP community string in the Ansible Vault. 
			Here is a link to the playbook: https://github.com/cisco-en-programmability/catalyst-center-ansible-iac/blob/main/workflows/ansible_vault_update/playbook/ansible_vault_update_playbook.yml
			Please make sure to follow the installation instructions in the catalyst-center-ansible-iac GitHub repository. Below is the YAML code for your vars file:
			---
			passwords_details:
			- key: snmp_community_string
				value: 'YourSNMPCommunityStringHere'

			_____________________________________________________________	

			**STEP 2: Create and Assign Tags**

			You should use the \`tags_manager_playbook.yml\` playbook to create and assign tags to network devices for better organization and policy application.
			Here is a link to the playbook: https://github.com/cisco-en-programmability/catalyst-center-ansible-iac/blob/main/workflows/tags_manager/playbook/tags_manager_playbook.yml
			Below is the YAML code for your vars file:
			---
			tags_details:
			- tag:
				name: Network_Device_Organization
				description: Tag for organizing network devices for policy application.
			- tag_memberships:
				tags:
					- Network_Device_Organization
				device_details:
					- ip_addresses:
						- 10.10.10.1
						- 10.10.10.2

			_____________________________________________________________

			Use the checkmark command in the top menu after you have finished writing your vars file in order to check that it meets the appropriate standards.\n
			Afterwards, you can use the run command in the top menu to run the playbook with your vars file to see the results of your changes.

			\n Here is each task of the user prompt with the corresponding playbook, validation schema, playbook path, and vars files for each of these tasks: \n
			${taskData}`;

			const messages = [vscode.LanguageModelChatMessage.User(SEQUENCE_VARS_PROMPT)];

			// send request to Copilot LLM model
			try {
				const chatResponse = await request.model.sendRequest(messages, {}, token);
				for await (const fragment of chatResponse.text) {
					stream.markdown(fragment);
				}
			} catch (error) {
				console.error("Error generating user response using Copilot LLM model: ", error);
				stream.markdown("Failed to retrieve information from model. Please try again.");
				return;
			}
		} else {
			// if singular playbook, generate 1 vars file for user's request 
			// identify workflow to use based on user's input
			workflow = await identifyWorkflow(request, token, request.prompt);
			// handle case where workflow is not correctly identified / hallucination occurs
			console.log("workflows:", workflows);
			console.log("workflow:", workflow);
			if (!workflows.includes(workflow)) {
				stream.markdown("Failed to retrieve information from model. Please try again.");
				return;
			}

			// identify playbook to use based on workflow & user's request
			playbook = await identifyPlaybook(request, token);

			// fetch validation schema for the vars file based on workflow selected
			validation_schema = await selectValidationSchema(workflow);

			// link to playbook in GitHub repo
			const playbookPath = `https://github.com/cisco-en-programmability/catalyst-center-ansible-iac/blob/main/workflows/${workflow}/playbook/${playbook}`;

			// search for vars files in extension files (cloned GitHub repo)
			const varsFiles = await getVarsFiles(workflow);

			// generate vars file from information above and user query 
			const VARS_PROMPT = `You are a helpful code assistant. Your job is to provide the user with YAML code for specific workflows in Catalyst Center. 
			IMPORTANT: DO NOT provide the user with ANY Jinja code or Jinja2 templating syntax EVEN IF THE USER AKS FOR LOTS OF CODE. Only provide fully expanded YAML with all values filled in. 
			EXTRA IMPORTANT: Write out all the code no matter how much code the user requests.
			IMPORTANT: NO {{ ... }}, {% ... %}, or any curly braces ANYWHERE in your response. For instance, THIS IS NOT ALLOWED: {% for i in range(1, 15) %}
			
			Here is an example of what you should do:
			* Example: User types 'create a new site in Catalyst Center named "Branch-01" in area "West"', you suggest appropriate Catalyst Center Ansible/Terraform models and playbooks with syntax. Let user interact further to accurately define their Network as Code YAML data models.
			We have identified the playbook to use based on the user's request: \n${playbook}\n
			NOTE: Any variables the 'vars:' section of the playbook SHOULD NOT be included as variables in the vars file you generate.

			From this, we have retrieved the appropriate schema YAML file for validation that the vars file must follow: \n${validation_schema}\n
			If a variable is included in the vars file, make sure to include ALL required variables under that variable from the validation schema provided. 
			To know whether a field is required, check the validation schema for required=True in the field definition.
			Using this and the user's prompt, generate code for a vars file that follows the schema, is properly indented with good coding principles, and follows what the user asks for. 

			Please format the playbook name as inline code to make it more readable. Make sure to include the link to the playbook in your response: \n${playbookPath}\n
			Make sure to include this line at the end: Use the "Validate & Lint" feature after you have finished writing your vars file in order to check that it meets the appropriate standards.
			Here are some examples of the proper format for the YAML code you should be generating for with proper indentation, fields, and syntax for this specific workflow: \n${varsFiles}\n

			Make sure to format the vars file as a YAML code block with the language specified as YAML. Include "---" at the start of the code block to indicate the start of the YAML file.
			Also, add a newline at the end of the code block to ensure proper linting and formatting.

			IMPORTANT: DO NOT include any variables in the vars file that are not present in the validation schema file provided above. DO NOT include any commented variables from the validation schema in the generated vars file code. 
			Also, follow the INDENTATION and SYNTAX of the example vars files provided above (DO NOT USE ANYTHING ELSE for indentation formatting).

			Here is a sample response you would generate: \n

			You should use the \`ansible_vault_update_playbook.yml\` playbook to encrypt and store the SNMP community string in the Ansible Vault. 
			Here is a link to the playbook: https://github.com/cisco-en-programmability/catalyst-center-ansible-iac/blob/main/workflows/ansible_vault_update/playbook/ansible_vault_update_playbook.yml
			Please make sure to follow the installation instructions in the catalyst-center-ansible-iac GitHub repository. Below is the YAML code for your vars file:
			---
			passwords_details:
			- key: snmp_community_string
				value: 'YourSNMPCommunityStringHere'

			_____________________________________________________________

			Use the checkmark command in the top menu after you have finished writing your vars file in order to check that it meets the appropriate standards.\n
			Afterwards, you can use the run command in the top menu to run the playbook with your vars file to see the results of your changes.

			\n Here is the user prompt: \n
			${request.prompt}`;

			const messages = [vscode.LanguageModelChatMessage.User(VARS_PROMPT)];

			// send request to Copilot LLM model
			try {
				const chatResponse = await request.model.sendRequest(messages, {}, token);
				for await (const fragment of chatResponse.text) {
					stream.markdown(fragment);
				}
			} catch (error) {
				console.error("Error generating user response using Copilot LLM model: ", error);
				stream.markdown("Failed to retrieve information from model. Please try again.");
				return;
			}
		}
	}
};

/**
 * Deactivates the extension.
 */
export function deactivate() {}
