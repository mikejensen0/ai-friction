import * as vscode from 'vscode';

let chatHistory: string[] = ["console.log('Hello World');\r\nlet b = 10;\r\nlet a = b + b\r\nconsole.log(a)", "Sample Text", "AI Response"];
let pastedCode: string[] = [];
let array1: number[] = [];
let array2: number[] = [];
export function activate(context: vscode.ExtensionContext) {
    const BASE_PROMPT = `You are a helpful code tutor. 
    Your job is to be cool`;
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
        
        let isCode = false;
        let isFirst = true;
        let code = '';

        // stream the response
        for await (const fragment of chatResponse.text) {
            stream.markdown(fragment);
            console.log(fragment);
            if (fragment.includes('```')) {
                isCode = !isCode;
            } 
            else if(isCode) {
                if(isFirst) {
                    isFirst = false;
                }
                else {
                    code += fragment;
                }
            }
        }

        if (code !== '') {
            code = code.trim();
            chatHistory.push(code);
            console.log(chatHistory);
        }
        
        return;
    };
        
    // create participant
    const tutor = vscode.chat.createChatParticipant('chat-tutorial.code-tutor', handler);
    
    // add icon to participant
    tutor.iconPath = vscode.Uri.joinPath(context.extensionUri, 'tutor.jpeg');
    
    stuff();
}

export function deactivate() {}

function stuff()  {
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
            vscode.window.showInformationMessage(`Pasted content: ${pastedContent}`);
            // Store the pasted content in a variable
            let capturedContent = pastedContent;
            console.log(`Captured content: ${capturedContent}`);
            const text = editor.document.getText();
            const decorations: vscode.DecorationOptions[] = [];
            array1.push(event.contentChanges[0].rangeOffset);
            array2.push(event.contentChanges[0].rangeOffset + pastedContent.length);
            for (let i = 0; i < array1.length; i++) {
                const startPos = editor.document.positionAt(array1[i]);
                const endPos = editor.document.positionAt(array2[i]);
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