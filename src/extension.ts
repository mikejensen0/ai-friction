import * as vscode from 'vscode';

let chatHistory: string[] = [];
let pastedCode: string[] = [];
let startPositions: number[] = [];
let endPositions: number[] = [];
export function activate(context: vscode.ExtensionContext) {
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

export function deactivate() {}

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