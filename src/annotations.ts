import * as vscode from 'vscode';
import { exec } from 'child_process';
import { workflow, validation_schema, validation_schema_file, playbook, getVarsFiles } from './extension.js';

// current active decorations / annotations to display
let activeDecorations: vscode.TextEditorDecorationType[] = []; 
const decoratedLines = new Set<number>();

async function yamale(textEditor: vscode.TextEditor, annotations: boolean = true, tempFilePath: string = ""): Promise<string> {
    // get schema validation file path
    console.log('Checking file syntax with yamale...');
    let validationFilePath = "";
    const uris = await vscode.workspace.findFiles("**/updated-catalyst-center-ansible-iac/**/*_schema.yml");
    const fileNames = uris.map(uri => uri.fsPath);
    console.log(fileNames[0]);
    console.log("files: ", fileNames);

    // identify schema file path from all documents 
    for (const f of fileNames) {
        if (f.includes(validation_schema_file)) {
            validationFilePath = f;
            break;
        }
    }

    let varsFilePath = "";
    if (tempFilePath) {
        varsFilePath = tempFilePath;
    } else {
        varsFilePath = textEditor.document.uri.fsPath;
    }

    console.log("validation file path for yamale: ", validationFilePath);

    // validation variables for yamale annotations
    let validationFailed = false;
    let validationError = "";
    let numSuggestions = -1;
    let formattedYamaleErrors: string[] = [];

    // get yamale path
    const yamalePath = vscode.workspace.getConfiguration('nac-copilot').get<string>('yamalePath');
    console.log('yamale path: ', yamalePath);

    // run yamale command using schema and vars files
    let yamaleOutputMessage: string = "";
    await new Promise<void>((resolve, reject) => {
        exec(`"${yamalePath}" -s "${validationFilePath}" -v "${varsFilePath}"`, (error: any, stdout: string, stderr: string) => {
            console.log('yamale errors: ', stderr);
            console.log('yamale output: ', stdout);
            if (stdout) {
                yamaleOutputMessage = stdout;
            }
            // if errors, send message logging them
            if (stderr) {
                let yamaleErrorOutput = stderr.split('\n').filter(line => line.trim() !== '');
                yamaleErrorOutput = yamaleErrorOutput.slice(yamaleErrorOutput.length-2);
                let error = "\n";
                for (const e of yamaleErrorOutput) {
                    error += e;
                }
                console.log('yamale error output: ', error);
                yamaleOutputMessage = error;
                if (annotations) {
                    // display error message as an error message block
                    vscode.window.showErrorMessage(`Validation Error: ${error}`);
                }
            } else if (stdout.includes("Validation failed!")) {
                const yamaleOutput = stdout.split('\n').filter(line => line.trim() !== '').slice(1);
                console.log('yamale output: ', yamaleOutput);

                let error = "";
                for (const e of yamaleOutput.slice(1)) {
                    error += e + "\n";
                    numSuggestions += 1;
                }
                console.log('yamale error output: ', error);
                yamaleOutputMessage = error;
                // display error message in information message and output channel 
                if (annotations) {
                    vscode.window.showErrorMessage(`Validation Failed: Check output channel for details.`);
                    const outputChannel = vscode.window.createOutputChannel('NaC Copilot');
                    outputChannel.appendLine('\nValidation Error:\n' + error);
                    outputChannel.show(true); 
                    validationFailed = true;
                    validationError = error;
                    formattedYamaleErrors = yamaleOutput.slice(2);
                }
            } else {
                // no errors --> print success statement 
                const yamaleOutput = stdout.split('\n').filter(line => line.trim() !== '').slice(1);
                console.log('yamale output: ', yamaleOutput);

                if (annotations) {
                    // Clear all active decorations if validation is successful
                    for (const d of activeDecorations) {
                        textEditor.setDecorations(d, []);
                        d.dispose();
                    }
                    activeDecorations = [];
                    decoratedLines.clear();

                    // display return message as a notification block
                    vscode.window.showInformationMessage(yamaleOutput[0]);
                }
            }
            resolve();
        });
    });

    if (annotations) {
        console.log("before trying to generate yamale annotations");
        console.log("validation failed: ", validationFailed);
        console.log("validation error: ", validationError);
        console.log("num suggestions: ", numSuggestions);
        if (validationFailed && validationError) {
            console.log("validation failure detected, generating annotations...");
            // get vars files for later use
            const varsFiles = await getVarsFiles(workflow, true, playbook);

            // generate code annotation based on yamale error output
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

                if (chatResponse) {
                    console.log("Annotations chat response received: ", chatResponse);

                    // parse chatResponse suggestions as a list
                    let accumulatedChatResponse = '';

                    for await (const fragment of chatResponse.text) {
                        accumulatedChatResponse += fragment;
                    }

                    console.log("Accumulated chat response: ", accumulatedChatResponse);

                    // convert chatResponse to a list of strings
                    const accumulatedChatResponseList: string[] = JSON.parse(accumulatedChatResponse);

                    // retrieve line numbers for suggestions (list)
                    const lineNumbers = await yamaleAnnotationLines(formattedYamaleErrors, textEditor);

                    let response = "";
                    for (let i = 0; i < lineNumbers.length; i++) {
                        response += `{ "line": ${lineNumbers[i]}, "suggestion": "${accumulatedChatResponseList[i]}" } `;
                    }
                    if (lineNumbers.length === 0) {
                        response = "{}";
                    }

                    console.log("Response from chat model w/ found line #s: ", response);
                    
                    await parseChatResponse(response, textEditor);
                }
            } catch (error) {
                console.error("Error sending request to chat model:", error);
                vscode.window.showErrorMessage('Failed to get annotations from the model. Please try again.');
            }
        }
    }
    return yamaleOutputMessage;
}

async function yamaleAnnotationLines(response: string[], textEditor: vscode.TextEditor): Promise<number[]> {
    let lines: number[] = [];
    const codeWithLineNumbers = getVisibleCodeWithLineNumbers(textEditor);

    for (const r of response) {
        // separate r by "."
        const parts = r.split(":")[0].split(".");
        console.log("parts: ", parts);

        // if just 1 part, line 1
        if (parts.length === 1) {
            lines.push(1);
            continue;
        } else if (parts.length > 1) {
            let keyParts: string[];
            if (r.includes("missing")) {
                // omit last part if field missing & find location of second to last part 
                keyParts = parts.slice(0, -1);
            } else {
                // else keep all parts
                keyParts = parts;
            }
            console.log("key parts: ", keyParts);

            let currentLine = 1;
            for (const p of keyParts) {
                console.log(`current line for ${p}: ${currentLine}`);
                // check if part is a number
                if (isNaN(parseInt(p, 10))) {
                    // find p in code
                    const splitCodeLines = codeWithLineNumbers.split('\n');
                    for(let i = currentLine; i < splitCodeLines.length; i++) {
                        const lineWithoutNumber = splitCodeLines[i].replace(/^\d+:\s*/, '');

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
                    // find pth "-" after currentLine in code
                    let numDashes = 0;
                    const splitCodeLines = codeWithLineNumbers.split('\n');
                    let foundFirstElem = false;
                    let indentation = "";

                    for(let i = currentLine; i < splitCodeLines.length; i++) {
                        const lineWithoutNumber = splitCodeLines[i].replace(/^\d+:\s*/, '');

                        if (lineWithoutNumber.trim().startsWith('-')) {
                            if (!foundFirstElem) {
                                const matchIndent = lineWithoutNumber.match(/^(\s*)-/);
                                if (matchIndent) {
                                    indentation = matchIndent[1];
                                    foundFirstElem = true;
                                }
                            }

                            if (numDashes === parseInt(p, 10) && lineWithoutNumber.startsWith(indentation + "-")) {
                                // found matching dashed line
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
            lines.push(currentLine);
        }
    }
    console.log("lines for yamale annotations: ", lines);
    return lines;
}

async function ansibleYAMLLint(textEditor: vscode.TextEditor, annotations: boolean = true): Promise<string[]> {
    // get file extension
    console.log('Checking file syntax with ansible-lint & yamllint ...');
    const filePath = textEditor.document.uri.fsPath;
    console.log('File path: ', filePath);
    const fileExtension = filePath.split('.').pop()?.toLowerCase();

    // get ansible-lint & yamllint command paths
    const ansibleLintPath = vscode.workspace.getConfiguration('nac-copilot').get<string>('ansibleLintPath');
    console.log('Ansible-lint path: ', ansibleLintPath);
    const yamlLintPath = vscode.workspace.getConfiguration('nac-copilot').get<string>('yamlLintPath');
    console.log('Ansible-lint path: ', yamlLintPath);

    let lintOutput = ["", ""];

    // check if file is YAML file
    if (fileExtension == 'yaml' || fileExtension == 'yml') {
        // run ansible-lint command on file
        await new Promise<void>((resolve, reject) => {
            exec(`"${ansibleLintPath}" "${filePath}"`, (error: any, stdout: string, stderr: string) => {
                // console.log('ansible-lint output: ', stdout);
                if (stdout) {
                    // get ansible-lint output 
                    lintOutput[0] = stdout;
                    const ansibleLintOutput = stdout.split('\n').filter(line => line.trim() !== '');

                    if (annotations) {
                        // generate annotations based on ansible-lint output
                        for (let i = 0; i < ansibleLintOutput.length; i+=2) {
                            const message = ansibleLintOutput[i];
                            const file = ansibleLintOutput[i+1];
                            // extract line number and message from ansible-lint output
                            // ansible-lint output format: "filename:line_number: message"
                            const match = file.match(/:(\d+)$/);
                            if (match) {
                                const lineNumber = parseInt(match[1], 10);
                                const suggestion = message;
                                // apply decoration to text editor
                                applyDecoration(textEditor, lineNumber, suggestion);
                            }
                        }
                    }
                }
                resolve();
            });
        });

        await new Promise<void>((resolve, reject) => {
            exec(`"${yamlLintPath}" "${filePath}"`, (error: any, stdout: string, stderr: string) => {
                if (stdout) {
                    // get yamllint output 
                    lintOutput[1] = stdout;
                    const yamlLintOutput = stdout.split('\n').filter(line => line.trim() !== '');
                    console.log('yamllint output: ', yamlLintOutput);

                    if (annotations) {
                    // generate annotations based on yamllint output
                        for (let i = 1; i < yamlLintOutput.length; i+=1) {
                            const message = yamlLintOutput[i];
                            const output = message.split('  ').filter(entry => entry !== '');
                            const lineNumber = parseInt(output[0].split(':')[0]);
                            const suggestion = "[yamllint]: " + output[2];

                            console.log(`line ${lineNumber}: ${suggestion}`);
                            // apply decoration to text editor
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

function applyDecoration(editor: vscode.TextEditor, line: number, suggestion: string) {
	const badKeywords = ['indent', 'indented', 'align']
	// skip if line already has decoration
	if (decoratedLines.has(line) || badKeywords.some(keyword => suggestion.toLowerCase().includes(keyword))) {
		return;
	}
	const decorationType = vscode.window.createTextEditorDecorationType({
		after: {
			contentText: ` ${suggestion}`,
			color: 'grey'
		}
	});

	// add decoration type to active decorations
	activeDecorations.push(decorationType);

	// add line to decorated lines
	decoratedLines.add(line);

	// get end of line w/ specified line #
	const lineLength = editor.document.lineAt(line - 1).text.length;
	const range = new vscode.Range(
		new vscode.Position(line - 1, lineLength),
		new vscode.Position(line - 1, lineLength)
	);

	// show full message when user hovers over the message
	const decoration = {range: range, hoverMessage: suggestion};

	editor.setDecorations(decorationType, [decoration]);
}

async function parseChatResponse(
	response: string,
	textEditor: vscode.TextEditor
) {
	// clear previous decorations
	for (const d of activeDecorations) {
        textEditor.setDecorations(d, []);
        d.dispose();
    }
    activeDecorations = [];
    decoratedLines.clear();

	console.log("Accumulated chat response: ", response);

	if (response.includes('{}') && decoratedLines.size === 0) {
		vscode.window.showInformationMessage('No annotations needed. Your code is valid!');
	} else {
		const regex = /{[^}]*}/g;
		let match;

		while((match = regex.exec(response)) !== null) {
			const jsonString = match[0];
			try {
				const annotation = JSON.parse(jsonString);
				if (!annotation.suggestion.includes("{}")) {
					const lineLength = textEditor.document.lineAt(annotation.line - 1).text.length;
					const range = new vscode.Range(
						new vscode.Position(annotation.line - 1, lineLength),
						new vscode.Position(annotation.line - 1, lineLength)
					);
					
					const decorationType = vscode.window.createTextEditorDecorationType({
						after: {
							contentText: ` ${annotation.suggestion}`,
							color: 'grey'
						}
					});
					textEditor.setDecorations(decorationType, [range]);
					activeDecorations.push(decorationType);
					decoratedLines.add(annotation.line);
				}
			} catch (e) {
				console.error('Failed to parse JSON string:', jsonString, e);
			}
		}
	}
}

function getVisibleCodeWithLineNumbers(textEditor: vscode.TextEditor) {
	let code = '';
	const totalLines = textEditor.document.lineCount;

	// get text from line @ current position
	for (let i = 0; i < totalLines; i++) {
		// includes indentation spaces
		code += `${i + 1}: ${textEditor.document.lineAt(i).text} \n`
	}

	return code;
}

export { yamale, ansibleYAMLLint };