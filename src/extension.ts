// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

const annotatedLines = new Set<number>();
const decorationTypes = new Map<number, vscode.TextEditorDecorationType>();
export function activate(context: vscode.ExtensionContext) {


	const ANNOTATION_PROMPT = `You are a code tutor who helps students learn how to write better code. Your job is to evaluate a block of code that the user gives you and then annotate any lines that could be improved with a brief suggestion and the reason why you are making that suggestion. Only make suggestions when you feel the severity is enough that it will impact the readability and maintainability of the code. Be friendly with your suggestions and remember that these are students so they need gentle guidance. Format each suggestion as a single JSON object. It is not necessary to wrap your response in triple backticks. Here is an example of what your response should look like:

{ "line": 1, "suggestion": "I think you should use a for loop instead of a while loop. A for loop is more concise and easier to read." }{ "line": 12, "suggestion": "I think you should use a for loop instead of a while loop. A for loop is more concise and easier to read." }
`;
	const BASE_PROMPT = 'You are a coding assistants. Your job is to provide multiple examples of coding solutions to the user. Respond with multiple potental solutions to the problem the user wants to solve. If the user explicitly requests a singular solution, guide them to find the answer themselves. If the user asks a non-programming question, politely decline to respond.';
	const FRICTIONLESS_PROMPT =	'You are a helpful code tutor. Your job is to teach the user with simple descriptions and sample code of the concept. Respond with a guided overview of the concept in a series of messages. Do not give the user the answer directly, but guide them to find the answer themselves. If the user asks a non-programming question, politely decline to respond.';
	//const disposable = vscode.commands.registerTextEditorCommand('code-tutor.annotate', async (textEditor: vscode.TextEditor) => {	
	//	const codeWithLineNumbers = getVisibleCodeWithLineNumbers(textEditor);
	vscode.workspace.onDidChangeTextDocument(async (event) => {
        const textEditor = vscode.window.activeTextEditor;
        if (textEditor && event.document === textEditor.document) {
            const codeWithLineNumbers = getVisibleCodeWithLineNumbers(textEditor);
		let [model] = await vscode.lm.selectChatModels({
			vendor: 'copilot',
			family: 'gpt-4o'
		  });

		const messages1 = [
			vscode.LanguageModelChatMessage.User(ANNOTATION_PROMPT),
			vscode.LanguageModelChatMessage.
			User(codeWithLineNumbers)
		  ];
		if (model) {
			// send the messages array to the model and get the response
			let chatResponse = await model.sendRequest(
			  messages1,
			  {},
			  new vscode.CancellationTokenSource().token
			);
	  
			// handle chat response
			await parseChatResponse(chatResponse, textEditor);
		}
		for (const line of annotatedLines) {
            const lineText = textEditor.document.lineAt(line - 1).text;
            if (lineText.includes('...')) { // Replace with the actual condition to check if the suggestion is fulfilled
                const decorationType = decorationTypes.get(line);
                if (decorationType) {
                    textEditor.setDecorations(decorationType, []);
                    annotatedLines.delete(line);
                    decorationTypes.delete(line);
                }
            }
        }
	}});
	

	//'You are a helpful code tutor. Your job is to teach the user with simple descriptions and sample code of the concept. Respond with a guided overview of the concept in a series of messages. Do not give the user the answer directly, but guide them to find the answer themselves. If the user asks a non-programming question, politely decline to respond.';
	// This method is called when your extension is activated
	// Your extension is activated the very first time the command is executed
	
	const handler: vscode.ChatRequestHandler = async (
		request: vscode.ChatRequest,
		context: vscode.ChatContext,
		stream: vscode.ChatResponseStream,
		token: vscode.CancellationToken
	  ) => {
		
		
		// initialize the prompt
		let prompt = BASE_PROMPT;

		if (request.command === 'frictionless'){
			prompt = FRICTIONLESS_PROMPT;
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
	  
		// stream the response
		for await (const fragment of chatResponse.text) {
		  stream.markdown(fragment);
		}
	  
		return;
		
	  };
	  // create participant
const tutor = vscode.chat.createChatParticipant('chat-tutorial.code-tutor', handler);

// add icon to participant
tutor.iconPath = vscode.Uri.joinPath(context.extensionUri, 'tutor.jpeg');
}



function applyDecoration(editor: vscode.TextEditor, line: number, suggestion: string) {
	if (annotatedLines.has(line)) {
        return;
    }
    const commandId = `code-tutor.removeSuggestion-${line}`;


	const decorationType = vscode.window.createTextEditorDecorationType({
	  after: {
		contentText: ` ${suggestion.substring(0, 25) + '...'}`,
		color: 'grey',
		margin: '0 0 0 1em',
	  }
	});
	vscode.commands.registerCommand(commandId, () => {
        editor.setDecorations(decorationType, []);
        annotatedLines.delete(line);
        decorationTypes.delete(line);
    });
	// get the end of the line with the specified line number
	const lineLength = editor.document.lineAt(line - 1).text.length;
	const range = new vscode.Range(
	  new vscode.Position(line - 1, lineLength),
	  new vscode.Position(line - 1, lineLength)
	);
  
    const decoration = { range: range, hoverMessage: new vscode.MarkdownString(`Click [Remove](command:${commandId}) to remove this suggestion.`) };
	decoration.hoverMessage.isTrusted = true; // Allow the command link to be trusted

  
	vscode.window.activeTextEditor?.setDecorations(decorationType, [decoration]);
	annotatedLines.add(line);
	decorationTypes.set(line, decorationType);
    
	// Add a command to remove the suggestion when the link is clicked

  }

async function parseChatResponse(
	chatResponse: vscode.LanguageModelChatResponse,
	textEditor: vscode.TextEditor
  ) {
	let accumulatedResponse = '';
  
	for await (const fragment of chatResponse.text) {
	  accumulatedResponse += fragment;
  
	  // if the fragment is a }, we can try to parse the whole line
	  if (fragment.includes('}')) {
		try {
		  const annotation = JSON.parse(accumulatedResponse);
		  applyDecoration(textEditor, annotation.line, annotation.suggestion);
		  // reset the accumulator for the next line
		  accumulatedResponse = '';
		} catch (e) {
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

  vscode.commands.registerCommand('code-tutor.removeSuggestions', () => {
    const textEditor = vscode.window.activeTextEditor;
    if (textEditor) {
        for (const [line, decorationType] of decorationTypes) {
            textEditor.setDecorations(decorationType, []);
        }
        annotatedLines.clear();
        decorationTypes.clear();
    }
});
// This method is called when your extension is deactivated
export function deactivate() {}
