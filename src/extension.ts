import * as vscode from 'vscode';

const ANNOTATION_PROMPT = `You are a code tutor who helps students learn how to write better code. 
Your job is to evaluate a block of code that the user gives you. 
The user is writing You will then annotate any lines that could be improved with a brief suggestion and the reason why you are making that suggestion.
Only make suggestions when you feel the severity is enough that it will impact the readibility and maintainability of the code. 
Be friendly with your suggestions and remember that these are students so they need gentle guidance.
Do not not make suggestions to empty lines. 
Format each suggestion as a single JSON object. 
It is not necessary to wrap your response in triple backticks.
Here is an example of what your response should look like:

{ "line": 1, "suggestion": "I think you should use a for loop instead of a while loop. A for loop is more concise and easier to read." }
{ "line": 12, "suggestion": "I think you should use a for loop instead of a while loop. A for loop is more concise and easier to read." }
`;

let chatHistory: string[] = [];
let pastedCode: string[] = [];
let startPositions: number[] = [];
let endPositions: number[] = [];
let showFeedbackTooltip = true;

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	highlightAiCopiedCode(context);
	aiCodeSuggestions();
}

function highlightAiCopiedCode(context: vscode.ExtensionContext){
	const BASE_PROMPT = `You are a helpful code tutor.`;

    const handler: vscode.ChatRequestHandler = async (
        request: vscode.ChatRequest,
        context: vscode.ChatContext,
        stream: vscode.ChatResponseStream,
        token: vscode.CancellationToken
        ) => {
        // initialize the prompt
        let prompt = BASE_PROMPT;
        

        // initialize the messages array with the prompt
        const messages = [vscode.LanguageModelChatMessage.User(prompt)];
        

        // get all the previous participant messages
        const previousMessages = context.history.filter(
            h => h instanceof vscode.ChatResponseTurn
        );
        
        // add the previous messages to the messages array
        previousMessages.forEach(m => {
            let fullMessage = '';
            m.response.forEach(r => {
                const mdPart = r as vscode.ChatResponseMarkdownPart;
                fullMessage += mdPart.value.value;
            });
            messages.push(vscode.LanguageModelChatMessage.Assistant(fullMessage));
        });

        // add in the user's message
        messages.push(vscode.LanguageModelChatMessage.User(request.prompt));
        
        // send the request
        const chatResponse = await request.model.sendRequest(messages, {}, token);
        
        let isFirst = false;
        let response = '';
        let code = [];

        // stream the response
        for await (const fragment of chatResponse.text) {
            stream.markdown(fragment);
            if (isFirst) {
                if(!fragment.includes("`")) {
                    isFirst = false;
                }
            }
            else {
                response += fragment;
            }
            if (fragment.includes("```")) {
                isFirst = true;
            }
        }

        if (response !== '') {
            code = ExtractCodeBlocks(response);
            code.forEach((block) => {
                chatHistory.push(block);
            });
            console.log(chatHistory);
        }
        
        return;
    };
        
    // create participant
    const tutor = vscode.chat.createChatParticipant('chat-tutorial.code-tutor', handler);
    
    // add icon to participant
    tutor.iconPath = vscode.Uri.joinPath(context.extensionUri, 'tutor.jpeg');
    
    CopyPasteColouring();
}

function CopyPasteColouring()  {
    const decorationType = vscode.window.createTextEditorDecorationType({
        backgroundColor: 'rgba(58,61,65,0.8)', // Grey highlight
        rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
    });

    vscode.workspace.onDidChangeTextDocument(event => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;
        if(event.document.fileName.includes("\\response_")) return;
        const pastedContent = event.contentChanges[0].text;

        if (pastedContent.length > 4) {
            const pastedLines = SplitCodeLines(pastedContent);
            let match = false;

            for (const chatEntry of chatHistory) {
                const chatLines = SplitCodeLines(chatEntry);
                // Iterate through each possible starting index in chatLines
                for (let i = 0; i < chatLines.length; i++) {
                    console.log("Line " + i + ": " + chatLines[i]);
                    if(chatLines[i] === pastedLines[0]){
                        match = true;

                        for (let j = 0; j < pastedLines.length; j++) {
                            if (chatLines[i + j] !== pastedLines[j]) {
                                match = false;
                                break;
                            }
                        }
                    }
                }

                if (match) {
                    pastedCode.push(pastedContent);

                    const decorations: vscode.DecorationOptions[] = [];
                    startPositions.push(event.contentChanges[0].rangeOffset);
                    endPositions.push(event.contentChanges[0].rangeOffset + pastedContent.length);

                    for (let k = 0; k < startPositions.length; k++) {
                        const startPos = editor.document.positionAt(startPositions[k]);
                        const endPos = editor.document.positionAt(endPositions[k]);
                        decorations.push({ range: new vscode.Range(startPos, endPos) });
                        console.log("highlight");
                    }

                    editor.setDecorations(decorationType, decorations);
                    break;
                }
            }
        }
        
        const text = editor.document.getText();
        const decorations: vscode.DecorationOptions[] = [];

        pastedCode.forEach(searchString => {
            // Use a loop to find all instances of the search string
            let startIndex = 0;
            while (startIndex < text.length) {
            const index = text.indexOf(searchString, startIndex);
            if (index === -1) {
                break;
            }
            const startPos = editor.document.positionAt(index);
            const endPos = editor.document.positionAt(index + searchString.length);
            decorations.push({ range: new vscode.Range(startPos, endPos) });
            startIndex = index + searchString.length;
            }
        });
    
        editor.setDecorations(decorationType, decorations);
    });
}

function ExtractCodeBlocks(text: string): string[] {
    const parts = text.split("```"); 
    const code: string[] = [];

    for (let i = 1; i < parts.length; i += 2) {
        let codeFix = parts[i].trim();

        codeFix = codeFix
            .split("\n")
            .join("\r\n");
        
        code.push(codeFix);
    }

    return code;
}

function SplitCodeLines(code: string): string[] {
    return code.split("\r\n")
        .map(line => line.replace(/^\s+/, ""));
}

let decorationTypes: Map<number, vscode.TextEditorDecorationType> = new Map();
const intermediateDecorationTypes: Map<number, vscode.TextEditorDecorationType> = new Map();
let debounceTimer: NodeJS.Timeout | undefined;

let previousLineCount: number | null = null;


function aiCodeSuggestions() {
    vscode.workspace.onDidChangeTextDocument((e) => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document !== e.document || e.document.fileName.includes("\\response_")) return;

        const newLineCount = e.document.lineCount;
        const oldLineCount = previousLineCount ?? newLineCount; // Use stored count, defaulting to current if null

        let minChangedLine = Infinity;
        let maxChangedLine = -1;

        e.contentChanges.forEach(change => {
            const startLine = change.range.start.line;
            const endLine = change.range.end.line;
            
            //line is zero indexed so we need to add 1 to get the actual line number
            for (let line = startLine + 1; line <= endLine + 1; line++) {
                if (decorationTypes.has(line)) {
                    decorationTypes.get(line)?.dispose();
                    decorationTypes.delete(line);
                }
            }
            minChangedLine = Math.min(minChangedLine, startLine);
            maxChangedLine = Math.max(maxChangedLine, endLine);
        });

        const lineDifference = newLineCount - oldLineCount;

        if (lineDifference !== 0 && maxChangedLine < oldLineCount - 1) {
            decorationTypes.forEach((decoration, key) => {
                let newKey = key;
                if (key > maxChangedLine) {
                    newKey = key + lineDifference;
                }
                intermediateDecorationTypes.set(newKey, decoration);
            });
                decorationTypes.clear()
                decorationTypes = new Map(intermediateDecorationTypes);
                intermediateDecorationTypes.clear()
        }

        previousLineCount = newLineCount;

        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }
        debounceTimer = setTimeout(async () => {
            await annotateVisibleEditor(editor);
        }, 3000);
    });
}
async function annotateVisibleEditor(editor: vscode.TextEditor) {
    const codeWithLineNumbers = getVisibleCodeWithLineNumbers(editor);

    const [model] = await vscode.lm.selectChatModels({
        vendor: 'copilot',
        family: 'gpt-4o',
    });

    const messages = [
        vscode.LanguageModelChatMessage.User(ANNOTATION_PROMPT),
        vscode.LanguageModelChatMessage.User(codeWithLineNumbers),
    ];

    if (model) {
        const chatResponse = await model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);
        await parseChatResponse(chatResponse, editor);
    }
    else {
        return;
    }
}
async function parseChatResponse(chatResponse: vscode.LanguageModelChatResponse, textEditor: vscode.TextEditor) {
	let accumulatedResponse = "";
    let suggestionsForThisEvaluation: number[]  = [];

	for await (const fragment of chatResponse.text) {
		accumulatedResponse += fragment;
		// if the fragment is a }, we can try to parse the whole line
		if (fragment.includes("}")) {
			try {
				const annotation = JSON.parse(accumulatedResponse);
				applyDecoration(textEditor, annotation.line, annotation.suggestion);
                suggestionsForThisEvaluation.push(annotation.line);
				// reset the accumulator for the next line
				accumulatedResponse = "";
			}
			catch {
				// do nothing
			}
		}
	}
    decorationTypes.forEach((value, key) => {
        if (decorationTypes.has(key) && !suggestionsForThisEvaluation.includes(key)){
            decorationTypes.get(key)?.dispose();
        }
    });
    suggestionsForThisEvaluation = [];
}

function getVisibleCodeWithLineNumbers(textEditor: vscode.TextEditor) {
    const totalLines = textEditor.document.lineCount;
    let code = '';

    for (let line = 0; line < totalLines; line++) {
        code += `${line + 1}: ${textEditor.document.lineAt(line).text}\n`;
    }
    return code;
}



function applyDecoration(editor: vscode.TextEditor, line: number, suggestion: string) {
    if (decorationTypes.has(line)) {
        decorationTypes.get(line)?.dispose();
    }

    if (showFeedbackTooltip) {
        showFeedbackTooltip = false
        vscode.window.showInformationMessage( "Inline feedback: " + "\"" + suggestion.substring(0, 25) + "..." + "\"" + " Hover over the feedback in the code to see full message.")
    }
	const decorationType = vscode.window.createTextEditorDecorationType({
		after: {
			contentText: ` ${suggestion.substring(0, 25) + "..."}`,
			color: "grey",
		},
	});
    decorationTypes.set(line, decorationType);

	// get the end of the line with the specified line number
	const lineLength = editor.document.lineAt(line - 1).text.length;
	const range = new vscode.Range(
		new vscode.Position(line - 1, lineLength),
		new vscode.Position(line - 1, lineLength),
	);

	const decoration = { range: range, hoverMessage: suggestion };
	editor.setDecorations(decorationType, [decoration]);
}

export function deactivate() {}
