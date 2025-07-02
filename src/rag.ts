import * as vscode from 'vscode';
import fs from 'fs';
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { pipeline } from '@xenova/transformers';

// global state variables shared across RAG functions
let workflows: string[] = [];
let workflowToREADMEs: { [key: string]: string } = {};

// vector DB for RAG storage
let vectorDB: MemoryVectorStore | null = null;

/**
 * Indexes data for RAG (Step 1): chunks READMEs, embeds them, & stores in vector DB.
 */
async function indexDataRAG() {
    // chunk READMEs using LangChain Text Splitter
    let chunks: { text: string, metadata: { workflow: string } }[] = [];
    const textSplitter = new RecursiveCharacterTextSplitter({chunkSize: 500, chunkOverlap: 100});

    // loop through each workflow to chunk its README
    for (const w of workflows) {
        const readme = workflowToREADMEs[w];
        if (readme) {
            const readmeChunks = await textSplitter.splitText(readme);
            // add chunks with workflow metadata
            chunks.push(...readmeChunks.map((chunk: string) => ({
                text: chunk,
                metadata: { workflow: w }
            })));
        } else {
            // if no README found, add name of workflow as a single chunk
            chunks.push({
                text: `Workflow: ${w}`,
                metadata: { workflow: w }
            });
        }
    }

    // retrieve embeddings
    const embeddings = await retrieveEmbeddings();

    // store embeddings in vector DB
    vectorDB = await MemoryVectorStore.fromTexts(
        chunks.map(chunk => chunk.text),
        chunks.map(chunk => chunk.metadata),
        embeddings,
    );
}

/**
 * Retrieves embeddings using Xenova's all-MiniLM-L6-v2 model.
 * Returns an object with methods to embed documents and queries.
 */
async function retrieveEmbeddings() {
    const embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    const embeddings = {
        // function for embedding READMEs / documents
        async embedDocuments(texts: string[]): Promise<number[][]> {
            const results = [];
            for (const t of texts) {
                const output = await embedder(t, {pooling: 'mean', normalize: true});
                results.push(Array.from(output.data));
            }
            return results;
        },

        // function for embedding a query
        async embedQuery(text: string): Promise<number[]> {
            const output = await embedder(text, {pooling: 'mean', normalize: true});
            return Array.from(output.data);
        }
    }
    return embeddings;
}

/**
 * Retrieves and generates workflow using RAG (Step 2): embeds user query, retrieves top-K chunks using similarity search, & augments LLM with top chunks to retrieve relevant workflow.
 * Returns identified workflow as a string.
 */
async function retrieveAndGenerateRAGWorkflow(userQuery: string, k: number = 5, request: vscode.ChatRequest, token: vscode.CancellationToken): Promise<string> {
    // ensure vector DB is initialized
    if (!vectorDB) {
        return "";
    }

    // embed user query 
    const embeddings = await retrieveEmbeddings();
    const userQueryEmbedding = await embeddings.embedQuery(userQuery);

    // retrieve top-K relevant chunks from vector DB using similarity search
    const topKResults = await vectorDB.similaritySearchVectorWithScore(userQueryEmbedding, k);

    // create prompt for LLM (user query + top-K retrieved chunks)
    const topKChunks = topKResults.map((r: any) => r[0].pageContent);
    const topKWorkflows = topKResults.map((r: any) => r[0].metadata?.workflow || "unknown");

    const prompt = `You are a helpful code assistant. Your job is to provide the user with YAML code for specific workflows in Catalyst Center. Here is an example of what you should do:
    * Example: User types 'create a new site in Catalyst Center named "Branch-01" in area "West"', you suggest appropriate Catalyst Center Ansible/Terraform models and playbooks with syntax. Let user interact further to accurately define their Network as Code YAML data models.
    
    First, you must figure out which workflow to use based on the user's request. Here is an overview of the top workflows corresponding to the user's request and some descriptions of each workflow. 
    The modules/workflows are clearly depicted as "Workflow <X>" where X is the name of the workflow right right before the description. 
    Anything not written as "Workflow <X>" and on its own line is not a workflow. \n\n
    \n ${topKChunks.map((chunk, i) => `Workflow ${topKWorkflows[i]}: \n${chunk}`).join("\n\n")} \n

    You must choose the workflow that best matches the user's request. Here is the full list of valid workflow names (choose only one, exactly as written): 
    ${workflows.map(w => `- ${w}`).join('\n')}

    Return only the workflow name, exactly as it appears above, and nothing else.

    Using these descriptions in the dictionary provided, you will determine which module or workflow to use based on the user's request. Do not list the name of any module or workflow not listed from the 37 above that are clearly numbered as "Workflow #". 
    ONLY RETURN THE NAME of the module/workflow as a string. Do NOT include any additional text.

    Here is an example response: site_hierarchy\n
    Here is another example response: swim \n
    Here is the user prompt: \n${request.prompt}\n`;

    // send prompt to LLM & parse result
    const messages = [vscode.LanguageModelChatMessage.User(prompt)];
    let identifiedWorkflow = '';

    // send request to Copilot LLM model
    try {
        const chatResponse = await request.model.sendRequest(messages, {}, token)
        let result = '';
        for await (const fragment of chatResponse.text) {
            result += fragment;
        }
        identifiedWorkflow = result;
    } catch (error) {
        console.error("Error identifying workflow using Copilot LLM model: ", error);
    }

    return identifiedWorkflow;
}

/**
 * Retrieves and generates general text response using RAG (Step 2): embeds user query, retrieves top-K chunks using similarity search, & augments LLM with top chunks to generate relevant response.
 * Returns response to user as a string.
 */
async function retrieveAndGenerateRAGGeneral(userQuery: string, k: number = 5, request: vscode.ChatRequest, token: vscode.CancellationToken): Promise<string> {
    // ensure vector DB is initialized
    if (!vectorDB) {
        return "";
    }

    // embed user query 
    const embeddings = await retrieveEmbeddings();
    const userQueryEmbedding = await embeddings.embedQuery(userQuery);

    // retrieve top-K relevant chunks from vector DB using similarity search
    const topKResults = await vectorDB.similaritySearchVectorWithScore(userQueryEmbedding, k);

    // create prompt for LLM (user query + top-K retrieved chunks)
    const topKChunks = topKResults.map((r: any) => r[0].pageContent);

    const prompt = `You are a helpful assistant. Your job is to answer any questions the user may have about Catalyst Center, Ansible, or anything generic that relates to whatever the user asks. 
    Do not provide any code or YAML unless the user specifically asks for it.
    Try to be concise in your response to not overload the user with information. Format the response so it is easier to read.
    Be prepared to answer follow up questions and remember the previous questions and responses in the conversation.

    Here is some relevant information related to the user's prompt that may help you answer the question. HOWEVER, for more general questions, use your knowledge rather than this repo specific knowledge:
    \n${topKChunks}\n

    Here is the user prompt: \n${request.prompt}\n`;

    // send prompt to LLM & parse result
    const messages = [vscode.LanguageModelChatMessage.User(prompt)];

    // send request to Copilot LLM model
    try {
        const chatResponse = await request.model.sendRequest(messages, {}, token)
        let result = '';
        for await (const fragment of chatResponse.text) {
            result += fragment;
        }
        return result;
    } catch (error) {
        console.error("Error answering question using Copilot LLM model: ", error);
    }
    return "Error: Unable to retrieve information. Please try again later.";
}

/**
 * Fetches README files from cloned GitHub repository in user's workspace.
 * Populates global state variables with workflow names and corresponding README content.
 */
async function fetchREADMEFiles() {
    // retrieve all workflows from cloned GitHub repo in user's workspace
    const workflowsDir = `${vscode.workspace.rootPath}/updated-catalyst-center-ansible-iac/workflows/`;
    const workflowNames = await fs.readdirSync(workflowsDir);

    // check if fetched READMEs includes all repo workflows
    if (workflows.length != 0 && workflowNames.every((w) => workflows.includes(w))) {
        return;
    }

    // else retrieve READMEs from cloned GitHub repo in user's workspace
    workflows = [];

    // for each workflow, retrieve README file content (if exists)
    for (const w of workflowNames) {
        const readmeUri = await vscode.workspace.findFiles(`**/updated-catalyst-center-ansible-iac/workflows/${w}/README.md`);
        if (readmeUri.length) {
            const readme = (await vscode.workspace.fs.readFile(vscode.Uri.file(readmeUri[0].fsPath))).toString();
            // retrieve names of playbooks in workflow
            const uris = await vscode.workspace.findFiles(`**/updated-catalyst-center-ansible-iac/workflows/${w}/playbook/*_playbook.yml`);
            const playbooks = uris.map(uri => uri.fsPath.replace(/^.*[\\/]/, ''));

            // add workflow & README to mapping
            workflowToREADMEs[w] = readme;
        } else {
            workflowToREADMEs[w] = "";
        }
        workflows.push(w);
    }
}

export { indexDataRAG, retrieveAndGenerateRAGWorkflow, retrieveAndGenerateRAGGeneral, fetchREADMEFiles };