import * as vscode from 'vscode';
import { exec } from 'child_process';
import { workflow, validation_schema, validation_schema_file, playbook, getVarsFiles, sequentialTasks, sequentialPlaybooks, selectValidationSchema } from './extension.js';

// global state variables shared across annotations functions
let activeDecorations: vscode.TextEditorDecorationType[] = []; 
const decoratedLines = new Set<number>();

/**
 * Generates annotations for YAML vars file using Yamale validation schema: 
 * Retrieves validation schema file, runs yamale command on vars file, and generates annotations based on yamale output.
 * Returns Yamale output message.
 */
async function yamale(annotations: boolean = true, tempFilePath: string = "", textEditor?: vscode.TextEditor, valPath: string = ""): Promise<string[]> {
    console.log("Checking file syntax with Yamale...");
    let validationFilePath = "";

    console.log("Sequential tasks?: ", sequentialTasks);
    console.log("Sequential playbooks: ", sequentialPlaybooks);

    // if sequential tasks have been identified, provide playbook options to user (to identify validation schema)
    if (sequentialTasks && valPath == "") {
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
        const fileNames = uris.map(uri => uri.fsPath);
        if (fileNames.length !== 0 && fileNames[0]) {
            validationFilePath = fileNames[0];
        }
    } else {
        // else handle singular vars file validation
        // handle case where workflow & validation_schema have not been identified
        if (!(workflow && validation_schema_file)) {
            if (!validation_schema_file && workflow) {
                vscode.window.showErrorMessage("Validation schema is not available for the identified workflow.");
            } else {
            vscode.window.showErrorMessage("Please use @assistant chat feature to identify playbook before performing validation.");
            }
            return [];
        }

        // get schema validation file path from cloned GitHub repo in user's workspace
        const uris = await vscode.workspace.findFiles("**/ai-assistant-catalyst-center-ansible-iac/**/*_schema.yml");
        const fileNames = uris.map(uri => uri.fsPath);

        // identify schema file path from all file paths 
        for (const f of fileNames) {
            if (f.includes(validation_schema_file)) {
                validationFilePath = f;
                break;
            }
        }
    }

    // identify vars file path from text editor or temp file path parameter
    let varsFilePath = "";
    if (tempFilePath) {
        varsFilePath = tempFilePath;
    } else if (textEditor) {
        varsFilePath = textEditor.document.uri.fsPath;
    } 

    // validation variables for Yamale annotations
    let validationFailed = false;
    let validationError = "";
    let numSuggestions = -1;
    let formattedYamaleErrors: string[] = [];
    let successfulValidation = false;

    // get Yamale path from settings.json configuration
    const yamalePath = vscode.workspace.getConfiguration('nac-copilot').get<string>('yamalePath');

    // run Yamale terminal command using validation schema and vars files
    let yamaleOutputMessage: string = "";
    await new Promise<void>((resolve, reject) => {
        exec(`"${yamalePath}" -s "${validationFilePath}" -v "${varsFilePath}"`, (error: any, stdout: string, stderr: string) => {
            if (stdout) {
                yamaleOutputMessage = stdout;
            }
            // if errors, send message to user logging them
            if (stderr) {
                let yamaleErrorOutput = stderr.split('\n').filter(line => line.trim() !== '');
                yamaleErrorOutput = yamaleErrorOutput.slice(yamaleErrorOutput.length-2);
                let error = "\n";
                for (const e of yamaleErrorOutput) {
                    error += e;
                }
                console.log("Yamale error output: ", error);
                yamaleOutputMessage = error;
                // if displaying annotations, notify user of validation error through error message
                if (annotations) {
                    vscode.window.showErrorMessage(`Validation Error: ${error}`);
                }
            } else if (stdout.includes("Validation failed!")) {
                const yamaleOutput = stdout.split('\n').filter(line => line.trim() !== '').slice(1);
        
                let error = "";
                for (const e of yamaleOutput.slice(1)) {
                    error += e + "\n";
                    numSuggestions += 1;
                }
                console.log("Yamale validation error output: ", error);

                yamaleOutputMessage = error;
                // if displaying annotations, notify user of validation error through error message & output channel
                if (annotations) {
                    vscode.window.showErrorMessage(`Validation Failed: Check output channel for details.`);
                    const outputChannel = vscode.window.createOutputChannel('NaC AI Assistant');
                    outputChannel.appendLine('\nValidation Error:\n' + error);
                    outputChannel.show(true); 
                    validationFailed = true;
                    validationError = error;
                    formattedYamaleErrors = yamaleOutput.slice(2);
                }
            } else {
                // if no errors, display success statement
                yamaleOutputMessage = stdout.split('\n').filter(line => line.trim() !== '').slice(1).join('\n');
                successfulValidation = true;

                // if displaying annotations & text editor available, clear all active decorations
                if (annotations && textEditor) {
                    for (const d of activeDecorations) {
                        textEditor.setDecorations(d, []);
                        d.dispose();
                    }
                    activeDecorations = [];
                    decoratedLines.clear();
                }
            }
            resolve();
        });
    });

    if (annotations && textEditor) {
        // if validation failed, generate annotations based on Yamale output
        if (validationFailed && validationError) {
            console.log("Validation failure detected, generating annotations...");

            // get sample vars files for later use
            const varsFiles = await getVarsFiles(workflow, true, playbook);

            // LLM prompt for generating annotations
            const ERROR_PROMPT = `You are a code assistant who helps customers fix their YAML code based on Yamale validation errors. 
            Your ONLY job is to annotate lines that match the error specified in the Yamale error output. 
            DO NOT annotate all lines, only annotate lines/sections that DIRECTLY relate to the validation error output provided.

            Yamale validation errors are formatted as:
            <key_path>: <error_message>

            - ONLY HAVE ONE SUGGESTION PER ERROR LINE IN THE ORDER OF THE ERROR OUTPUT.
            - DO NOT include the key path in your response, just the suggestion.
            - For example, with 'device.3.type: Required field missing', the key_path you should not include is device.3.type. Do NOT include anything in "device.3.type". This means DO NOT include "device.3" or "device.3.type" in your suggestion. 
            - DO NOT include the word "index" OR THE LOCATION of the suggestion in your response. I will later include code to find the correct line number. DO NOT DO THIS.
            - DO NOT include any ORDINAL words like "first", "second", "third" etc. in your response. Just provide the suggestion.
            - DO NOT reference the position or index of an entry in any way.
            - ONLY describe the fix needed, not WHERE it should be applied.
            - DO NOT MAKE SUGGESTIONS ON INDENTATION

            Format each suggestion as an item in a list of strings. Do not include any text before or after the JSON objects. DO NOT omit the brackets at the beginning and end of the list.
            Here is an example of what your response should look like. MAKE SURE TO FOLLOW THIS EXACT FORMAT and just edit the suggestions:

            ["suggestion 1", "suggestion 2", "suggestion 3"]

            The suggestions should be ordered such that each suggestion corresponds to ONE error in the Yamale output. THERE SHOULD NOT BE MORE SUGGESTIONS THAN ERRORS.
            FOR THIS SPECIFIC PROMPT, YOU SHOULD HAVE ${numSuggestions} SUGGESTIONS ONLY.

            For this specific prompt, here is the workflow: ${workflow}, playbook: ${playbook}, and validation schema: \n ${validation_schema} \n
            Here is also an example of a vars file that follows the validation schema: \n ${varsFiles} \n
            Here is the Yamale error output: \n ${validationError} \n`;

            const codeWithLineNumbers = getVisibleCodeWithLineNumbers(textEditor);
            let message_content = ERROR_PROMPT +
            "\nFor each annotation, specify the suggestion in the list of strings. Your response MUST be formatted as a list of strings." +
            "\nHere is the user code with line numbers:\n```yaml\n" +
            codeWithLineNumbers +
            "\n```\n";

            const messages = [vscode.LanguageModelChatMessage.User(message_content)];

            // send request to Copilot LLM model
            try {
                const chatResponse = await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: "Generating code suggestions to fix validation error..."
                }, async () => {
                    const models = await vscode.lm.selectChatModels({});
                    const model = models.length > 0 ? models[0] : undefined;

                    if (!model) {
                        vscode.window.showErrorMessage('No chat model available. Please check your settings.');
                        return;
                    }

                    return await model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);
                });

                // if chatResponse received, parse suggestions as a list
                if (chatResponse) {
                    let accumulatedChatResponse = '';

                    for await (const fragment of chatResponse.text) {
                        accumulatedChatResponse += fragment;
                    }

                    // convert chatResponse to a list of strings
                    const accumulatedChatResponseList: string[] = JSON.parse(accumulatedChatResponse);
                    console.log("Accumulated chat response received: ", accumulatedChatResponseList);

                    // retrieve line numbers for suggestions as a list
                    const lineNumbers = await yamaleAnnotationLines(formattedYamaleErrors, textEditor);

                    // format response as JSON objects with line numbers & suggestions
                    let response = "";
                    for (let i = 0; i < lineNumbers.length; i++) {
                        response += `{ "line": ${lineNumbers[i]}, "suggestion": "${accumulatedChatResponseList[i]}" } `;
                    }
                    if (lineNumbers.length === 0) {
                        response = "{}";
                    }

                    console.log("Response from chat model w/ found line #s: ", response);
                    
                    // parse chat response to apply annotations to code
                    await parseChatResponse(response, textEditor);
                }
            } catch (error) {
                console.error("Error generating Yamale code annotations using Copilot LLM model: ", error);
                vscode.window.showErrorMessage('Failed to get annotations from the model. Please try again.');
            }
        }
    }
    return [successfulValidation ? "true" : "false", yamaleOutputMessage];
}

/**
 * Identified line numbers for Yamale annotations based on validation schema error output: 
 * Utilizes format of Yamale error output message to identify appropriate field lines to annotate.
 * Example error output: "device.3.type: Required field missing"
 * Returns line numbers as a list of numbers per validation error.
 */
async function yamaleAnnotationLines(response: string[], textEditor: vscode.TextEditor): Promise<number[]> {
    let lines: number[] = [];
    const codeWithLineNumbers = getVisibleCodeWithLineNumbers(textEditor);

    for (const r of response) {
        // separate each error response by "." to get separated fields
        const parts = r.split(":")[0].split(".");

        // if just 1 part, add suggestion to line 1
        if (parts.length === 1) {
            lines.push(1);
            continue;
        } else if (parts.length > 1) {
            let keyParts: string[];
            // if error response includes "missing", add annotation to parent field
            if (r.includes("missing")) {
                // find location of second to last part if field missing
                keyParts = parts.slice(0, -1);
            } else {
                // else keep all parts
                keyParts = parts;
            }

            console.log("Key parts identified for annotation: ", keyParts);

            let currentLine = 1;
            for (const p of keyParts) {
                // check if part is a number
                if (isNaN(parseInt(p, 10))) {
                    // find part p in code starting from currentLine
                    const splitCodeLines = codeWithLineNumbers.split('\n');
                    for(let i = currentLine; i < splitCodeLines.length; i++) {
                        const lineWithoutNumber = splitCodeLines[i].replace(/^\d+:\s*/, '');

                        // if line contains part p, set currentLine to this line & proceed to next part
                        if (lineWithoutNumber.trim().includes(p)) {
                            // retrieve line number of this line
                            const matchLine = splitCodeLines[i].match(/^\d+/);
                            if (matchLine) {
                                currentLine = parseInt(matchLine[0], 10);
                            }
                            break;
                        }
                    }
                } else {
                    // if part is a number, find pth "-" after currentLine
                    let numDashes = 0;
                    const splitCodeLines = codeWithLineNumbers.split('\n');
                    let foundFirstElem = false;
                    let indentation = "";

                    for(let i = currentLine; i < splitCodeLines.length; i++) {
                        const lineWithoutNumber = splitCodeLines[i].replace(/^\d+:\s*/, '');

                        // if line starts with "-", check if it matches current list indentation
                        if (lineWithoutNumber.trim().startsWith('-')) {
                            // find indentation of first list element for future matching
                            if (!foundFirstElem) {
                                const matchIndent = lineWithoutNumber.match(/^(\s*)-/);
                                if (matchIndent) {
                                    indentation = matchIndent[1];
                                    foundFirstElem = true;
                                }
                            }

                            // if number of dashes matches p & indentation matches, set currentLine to this line
                            if (numDashes === parseInt(p, 10) && lineWithoutNumber.startsWith(indentation + "-")) {
                                // retrieve line number of this line
                                const matchLine = splitCodeLines[i].match(/^\d+/);
                                if (matchLine) {
                                    currentLine = parseInt(matchLine[0], 10);
                                }
                                break;
                            }
                            numDashes += 1;
                        }
                    }
                }
            }
            // add line found after parsing all parts to annotation lines
            lines.push(currentLine);
        }
    }
    console.log("Identified line numbers for Yamale annotations: ", lines);
    return lines;
}

/**
 * Generates annotations for YAML vars file using YAMLlint and Ansible Lint: 
 * Retrieves vars file, runs yamllint & ansible-lint commands on vars file, and generates annotations based on output.
 * Returns YAMLlint & Ansible Lint output messages as a list of strings
 */
async function ansibleYAMLLint(annotations: boolean = true, tempFilePath: string = "", textEditor?: vscode.TextEditor): Promise<string[]> {
    console.log("Checking file syntax with Ansible Lint & YAMLlint...");

    // identify vars file path from text editor or temp file path parameter
    let varsFilePath = "";
    if (tempFilePath) {
        varsFilePath = tempFilePath;
    } else if (textEditor) {
        varsFilePath = textEditor.document.uri.fsPath;
    } 
    const varsFileExtension = varsFilePath.split('.').pop()?.toLowerCase();

    // get Ansible Lint & YAMLlint paths from settings.json configuration
    const ansibleLintPath = vscode.workspace.getConfiguration('nac-copilot').get<string>('ansibleLintPath');
    const yamlLintPath = vscode.workspace.getConfiguration('nac-copilot').get<string>('yamlLintPath');

    let lintOutput = ["", ""];
 
    // ensure that vars file is YAML file
    if (varsFileExtension === 'yaml' || varsFileExtension === 'yml') {
        // run ansible-lint terminal command on vars file
        await new Promise<void>((resolve, reject) => {
            exec(`"${ansibleLintPath}" "${varsFilePath}"`, (error: any, stdout: string, stderr: string) => {
                // if no errors, get output
                if (stdout) {
                    lintOutput[0] = stdout;
                    const ansibleLintOutput = stdout.split('\n').filter(line => line.trim() !== '');
                    console.log("Ansible Lint output: ", ansibleLintOutput);

                    // if displaying annotations & text editor available, generate annotations based on Ansible Lint output
                    if (annotations && textEditor) {
                        for (let i = 0; i < ansibleLintOutput.length; i+=2) {
                            const message = ansibleLintOutput[i];
                            const file = ansibleLintOutput[i+1];
                            // extract line number and message from output
                            // Ansible Lint output format: "filename:line_number: message"
                            const match = file.match(/:(\d+)$/);
                            if (match) {
                                const lineNumber = parseInt(match[1], 10);
                                const suggestion = message;
                                // apply decoration to text editor to generate annotations
                                applyDecoration(textEditor, lineNumber, suggestion);
                            }
                        }
                    }
                }
                resolve();
            });
        });

        // run yamllint terminal command on vars file
        await new Promise<void>((resolve, reject) => {
            exec(`"${yamlLintPath}" "${varsFilePath}"`, (error: any, stdout: string, stderr: string) => {
                // if no errors, get output
                if (stdout) {
                    lintOutput[1] = stdout;
                    const yamlLintOutput = stdout.split('\n').filter(line => line.trim() !== '');
                    console.log("YAMLlint output: ", yamlLintOutput);

                    // if displaying annotations & text editor available, generate annotations based on YAMLlint output
                    if (annotations && textEditor) {
                        // YAMLlint output format: "line_number:column_number: [level] message"
                        for (let i = 1; i < yamlLintOutput.length; i+=1) {
                            const message = yamlLintOutput[i];
                            const output = message.split('  ').filter(entry => entry !== '');
                            const lineNumber = parseInt(output[0].split(':')[0]);
                            const suggestion = "[yamllint]: " + output[2];

                            // apply decoration to text editor to generate annotations
                            applyDecoration(textEditor, lineNumber, suggestion);
                        }
                    }
                }
                resolve();
            });
        });
    }

    return lintOutput;
}

/**
 * Applies decoration to text editor for a specific line with an annotation suggestion.
 */
function applyDecoration(editor: vscode.TextEditor, line: number, suggestion: string) {
	// skip if line already has decoration to not overload user
	if (decoratedLines.has(line)) {
		return;
	}
    // create decoration type if it doesn't already exist
	const decorationType = vscode.window.createTextEditorDecorationType({
		after: {
			contentText: ` ${suggestion}`,
			color: 'grey'
		}
	});

	// add decoration type to active decorations & line to decorated lines (global states)
	activeDecorations.push(decorationType);
	decoratedLines.add(line);

	// get range of specified line based on existing code in text editor
	const lineLength = editor.document.lineAt(line - 1).text.length;
	const range = new vscode.Range(
		new vscode.Position(line - 1, lineLength),
		new vscode.Position(line - 1, lineLength)
	);

	// show full message when user hovers over the message
	const decoration = {range: range, hoverMessage: suggestion};

    // add annotation decoration to text editor
	editor.setDecorations(decorationType, [decoration]);
}

/**
 * Parses chat response as JSON objects of line numbers & suggestions.
 */
async function parseChatResponse(response: string, textEditor: vscode.TextEditor) {
	// clear previous annotations from text editor
	for (const d of activeDecorations) {
        textEditor.setDecorations(d, []);
        d.dispose();
    }
    activeDecorations = [];
    decoratedLines.clear();

    // if response is empty or contains only empty objects, notify user that no annotations are needed
	if (response.includes('{}') && decoratedLines.size === 0) {
		return;
	} else {
        // match all JSON objects in the response string: {line: <line_number>, suggestion: <suggestion>}
		const regex = /{[^}]*}/g;
		let match;

        // while additional JSON objects exist in response, parse them & apply annotations
		while((match = regex.exec(response)) !== null) {
			const jsonString = match[0];
			try {
				const annotation = JSON.parse(jsonString);
				if (!annotation.suggestion.includes("{}")) {
					applyDecoration(textEditor, annotation.line, annotation.suggestion);
				}
			} catch (e) {
				console.error('Failed to parse JSON string for annotations: ', jsonString, e);
                vscode.window.showErrorMessage('Failed to get annotations from the model. Please try again.');
			}
		}
	}
}

/**
 * Retrieves code in current text editor with each line of code prefixed by its line number.
 * Returns code as a string with line numbers.
 */
function getVisibleCodeWithLineNumbers(textEditor: vscode.TextEditor) {
	let code = '';
	const totalLines = textEditor.document.lineCount;

    // iterate though all lines in text editor to get code by line number
	for (let i = 0; i < totalLines; i++) {
		code += `${i + 1}: ${textEditor.document.lineAt(i).text} \n`;
	}

	return code;
}

export { yamale, ansibleYAMLLint };