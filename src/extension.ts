import * as vscode from 'vscode';

let chatHistory: string[] = ["console.log('Hello World');\r\nlet b = 10;\r\nlet a = b + b\r\nconsole.log(a)", "Sample Text", "AI Response"];
let array1: number[] = [];
let array2: number[] = [];
export function activate(context: vscode.ExtensionContext) {

    const BASE_PROMPT = `You are a helpful code tutor. 
    Your job is to teach the user with simple descriptions and sample code of the concept.
    Respond with a guided overview of the concept in a series of messages. 
    Do not give the user the answer directly, but guide them to find the answer themselves. 
    If the user asks a non-programming question, politely decline to respond.`;
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
            vscode.window.showInformationMessage(`Pasted content: ${pastedContent}`);
            // Store the pasted content in a variable
            let capturedContent = pastedContent;
            console.log(`Captured content: ${capturedContent}`);
            const text = editor.document.getText();
            const decorations: vscode.DecorationOptions[] = [];
            array1.push(event.contentChanges[0].rangeOffset);
            array2.push(event.contentChanges[0].rangeOffset + pastedContent.length);
            //chatHistory.forEach(historyEntry => {
                //let matchIndex = text.indexOf(historyEntry);
               // while (matchIndex !== -1) {
               for (let i = 0; i < array1.length; i++) {
                    const startPos = editor.document.positionAt(array1[i]);
                    const endPos = editor.document.positionAt(array2[i]);
                    decorations.push({ range: new vscode.Range(startPos, endPos) });
               }
                  //  matchIndex = text.indexOf(historyEntry, matchIndex + 1);
                //}
           // });
    
            editor.setDecorations(decorationType, decorations);
        }


    });
}