import * as vscode from 'vscode';

const ANNOTATION_PROMPT = `You are a code tutor who helps students learn how to write better code. 
Your job is to evaluate a block of code that the user gives you. 
The user is writing You will then annotate any lines that could be improved with a brief suggestion and the reason why you are making that suggestion.
Only make suggestions when you feel the severity is enough that it will impact the readibility and maintainability of the code. 
Be friendly with your suggestions and remember that these are students so they need gentle guidance.
Do not not make suggestions to empty lines. 
Format each suggestion as a single JSON object. 
It is not necessary to wrap your response in triple backticks.
If you do not have a suggestion for a line leave the suggestion empty.
Here is an example of what your response should look like:

{ "line": 1, "suggestion": "I think you should use a for loop instead of a while loop. A for loop is more concise and easier to read." }
{ "line": 12, "suggestion": "I think you should use a for loop instead of a while loop. A for loop is more concise and easier to read." }
{ "line": 23, "suggestion": ""}
`;

const decorationTypes: Map<number, vscode.TextEditorDecorationType> = new Map();

let debounceTimer: NodeJS.Timeout | undefined;

let chatHistory: string[] = [];
let pastedCode: string[] = [];
let startPositions: number[] = [];
let endPositions: number[] = [];

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	bisgardsshit(context);
	sebastianshit();
}

function bisgardsshit(context: vscode.ExtensionContext){
	const BASE_PROMPT = `You are a helpful code tutor.`;
    const COMMAND_PROMPT = `You are a helpful tutor. 
    Your job is to teach the user with fun, simple exercises that they can complete in the editor.
    Your exercises should start simple and get more complex as the user progresses.
    Move one concept at a time, and do not move on to the next concept until the user provides the correct answer.
    Give hints in your exercises to help the user learn. If the user is stuck, you can provide the answer and explain why it is the answer.
    If the user asks a non-programming question, politely decline to respond.`;
    const handler: vscode.ChatRequestHandler = async (
        request: vscode.ChatRequest,
        context: vscode.ChatContext,
        stream: vscode.ChatResponseStream,
        token: vscode.CancellationToken
        ) => {
        // initialize the prompt
        let prompt = BASE_PROMPT;
        
        if (request.command === 'coolcommand') {
            prompt = COMMAND_PROMPT;
        }
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
            code = extractCodeBlocks(response);
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

function sebastianshit(){
    vscode.workspace.onDidChangeTextDocument((e) => {
        if (vscode.window.activeTextEditor?.document !== e.document) return;

        e.contentChanges.forEach(change => {
            const startLine = change.range.start.line + 1;
            const endLine = change.range.end.line + 1;

            for (let line = startLine; line <= endLine; line++) {
                if (decorationTypes.has(line)) {
                    decorationTypes.get(line)?.dispose();
                    decorationTypes.delete(line);
                }
            }
        });
		if (debounceTimer) {
            clearTimeout(debounceTimer);
        }
        debounceTimer = setTimeout(async () => {
            await annotateVisibleEditor();
        }, 3000); 
    });
    // Optional: run immediately at startup if you want
    annotateVisibleEditor().catch(console.error);
}

async function annotateVisibleEditor() {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
        console.log("No active editor");
        return;
    }

    // The logic from your command, directly placed into this function
    const codeWithLineNumbers = getVisibleCodeWithLineNumbers(activeEditor);

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
        await parseChatResponse(chatResponse, activeEditor);
    }
}
async function parseChatResponse(chatResponse: vscode.LanguageModelChatResponse, textEditor: vscode.TextEditor) {
	let accumulatedResponse = "";

	for await (const fragment of chatResponse.text) {
		accumulatedResponse += fragment;

		// if the fragment is a }, we can try to parse the whole line
		if (fragment.includes("}")) {
			try {
				const annotation = JSON.parse(accumulatedResponse);
				applyDecoration(textEditor, annotation.line, annotation.suggestion);
				// reset the accumulator for the next line
				accumulatedResponse = "";
			}
			catch {
				// do nothing
			}
		}
	}
}

function getVisibleCodeWithLineNumbers(textEditor: vscode.TextEditor) {
	// get the position of the first and last visible lines
	let currentLine = textEditor.visibleRanges[0].start.line;
	const endLine = textEditor.visibleRanges[0].end.line;

	let code = '';

	// get the text from the line at the current position.
	// The line number is 0-based, so we add 1 to it to make it 1-based.
	while (currentLine < endLine) {
		code += `${currentLine + 1}: ${textEditor.document.lineAt(currentLine).text} \n`;
		// move to the next line position
		currentLine++;
	}
	return code;
}


function applyDecoration(editor: vscode.TextEditor, line: number, suggestion: string) {

    if (decorationTypes.has(line) || suggestion === "") {
        decorationTypes.get(line)?.dispose();
    }
	if (suggestion === "") {
		return;
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
	vscode.window.activeTextEditor?.setDecorations(decorationType, [decoration]);

}

function CopyPasteColouring()  {
    const decorationType = vscode.window.createTextEditorDecorationType({
        backgroundColor: 'rgba(255, 255, 0, 0.3)', // Light yellow highlight
        rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
    });

    vscode.workspace.onDidChangeTextDocument(event => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;
        if (event.contentChanges[0].text.length > 10 && chatHistory.includes(event.contentChanges[0].text)) {
            const pastedContent = event.contentChanges[0].text;
            pastedCode.push(pastedContent);

            const decorations: vscode.DecorationOptions[] = [];
            startPositions.push(event.contentChanges[0].rangeOffset);
            endPositions.push(event.contentChanges[0].rangeOffset + pastedContent.length);
            for (let i = 0; i < startPositions.length; i++) {
                const startPos = editor.document.positionAt(startPositions[i]);
                const endPos = editor.document.positionAt(endPositions[i]);
                decorations.push({ range: new vscode.Range(startPos, endPos) });
            }

    
            editor.setDecorations(decorationType, decorations);
        }
        else {
        
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
        }
        

    });
}

function extractCodeBlocks(text: string): string[] {
    const parts = text.split("```"); 
    const code: string[] = [];

    for (let i = 1; i < parts.length; i += 2) {
        let codeFix = parts[i].trim();

        codeFix = codeFix.replace(/\n/g, "\r\n");
        code.push(codeFix);
    }

    return code;
}

export function deactivate() {}
