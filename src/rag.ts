import * as vscode from 'vscode';
import fs from 'fs';
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { pipeline } from '@xenova/transformers';


let workflows: string[] = [];
let fetchedREADMEs: string = "";
let workflowToREADMEs: { [key: string]: string } = {};

// vector DB for RAG storage
let vectorDB: MemoryVectorStore | null = null;

// RAG Step 1: Data Indexing
async function indexDataRAG() {
    // Step 1: Collect READMEs --> already collected in fetchREADMEFiles()

    // Step 2: Chunk READMEs (LangChain Text Splitter)
    let chunks: { text: string, metadata: { workflow: string } }[] = [];
    const textSplitter = new RecursiveCharacterTextSplitter({chunkSize: 500, chunkOverlap: 100});

    console.log("workflows: ", workflows);
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
            console.log(`No README found for workflow: ${w}`);
            chunks.push({
                text: `Workflow: ${w}`,
                metadata: { workflow: w }
            });
        }
    }

    // Step 3: Embed each chunk
    const embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    const embeddings = {
        // embed documents 
        async embedDocuments(texts: string[]): Promise<number[][]> {
            const results = [];
            for (const t of texts) {
                const output = await embedder(t, {pooling: 'mean', normalize: true});
                results.push(Array.from(output.data));
            }
            return results;
        },

        // embed query
        async embedQuery(text: string): Promise<number[]> {
            const output = await embedder(text, {pooling: 'mean', normalize: true});
            return Array.from(output.data);
        }
    }

    // Step 4: Store embeddings in vector DB (Memory Vector Store)
    vectorDB = await MemoryVectorStore.fromTexts(
        chunks.map(chunk => chunk.text),
        chunks.map(chunk => chunk.metadata),
        embeddings,
    );
}

// RAG Step 2: Data Retrieval & Generation - Workflow Identification
async function retrieveAndGenerateRAGWorkflow(userQuery: string, k: number = 5, request: vscode.ChatRequest, token: vscode.CancellationToken): Promise<string> {
    if (!vectorDB) {
        console.error("Vector DB has not been initialized. Make sure indexDataRAG() is properly being called first.");
        return "";
    }

    // Step 1: Embed user query 
    const embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    const embeddings = {
        // embed documents 
        async embedDocuments(texts: string[]): Promise<number[][]> {
            const results = [];
            for (const t of texts) {
                const output = await embedder(t, {pooling: 'mean', normalize: true});
                results.push(Array.from(output.data));
            }
            return results;
        },

        // embed query
        async embedQuery(text: string): Promise<number[]> {
            const output = await embedder(text, {pooling: 'mean', normalize: true});
            return Array.from(output.data);
        }
    }

    const userQueryEmbedding = await embeddings.embedQuery(userQuery);

    // Step 2: Retrieve top-K relevant chunks from vector DB (similarity search)
    const topKResults = await vectorDB.similaritySearchVectorWithScore(userQueryEmbedding, k);
    console.log("top-K results: \n", topKResults);

    // Step 3: Create prompt for LLM (user query + top-K retrieved chunks)
    const topKChunks = topKResults.map((r: any) => r[0].pageContent);
    const topKWorkflows = topKResults.map((r: any) => r[0].metadata?.workflow || "unknown");

    console.log(`\n TOP K WORKFLOWS: ${topKWorkflows.join(", ")}\n`);

    const prompt = `
    You are a helpful code assistant. Your job is to provide the user with YAML code for specific workflows in Catalyst Center. Here is an example of what you should do:
    * Example: User types 'create a new site in Catalyst Center named "Branch-01" in area "West"', you suggest appropriate Catalyst Center Ansible/Terraform models and playbooks with syntax. Let user interact further to accurately define their Network as Code YAML data models.
    
    First, you must figure out which workflow to use based on the user's request. Here is an overview of the top workflows corresponding to the user's request and some descriptions of each workflow. The modules/workflows are clearly depicted as "Workflow <X>" where X is the name of the workflow right right before the description. Anything not written as "Workflow <X>" and on its own line is not a workflow. \n\n
    
    \n
    ${topKChunks.map((chunk, i) => `Workflow ${topKWorkflows[i]}: \n${chunk}`).join("\n\n")}
    \n

    You must choose the workflow that best matches the user's request. Here is the full list of valid workflow names (choose only one, exactly as written): 
    ${workflows.map(w => `- ${w}`).join('\n')}

    Return only the workflow name, exactly as it appears above, and nothing else.

    Using these descriptions in the dictionary provided, you will determine which module or workflow to use based on the user's request. Do not list the name of any module or workflow not listed from the 37 above that are clearly numbered as "Workflow #". ONLY RETURN THE NAME of the module/workflow as a string. Do NOT include any additional text.
    Here is an example response: site_hierarchy\n
    Here is another example response: swim \n

    Here is the user prompt: \n${request.prompt}\n
    `;

    // Step 4: Send prompt to LLM & parse result
    const messages = [vscode.LanguageModelChatMessage.User(prompt)];
    let identifiedWorkflow = '';

    // send request to copilot llm model
    try {
        const chatResponse = await request.model.sendRequest(messages, {}, token)
        let result = '';
        for await (const fragment of chatResponse.text) {
            result += fragment;
        }
        identifiedWorkflow = result;
        console.log("identified workflow/module: ", identifiedWorkflow);
    } catch (error) {
        console.error("Error identifying workflow/module:", error);
    }

    return identifiedWorkflow;
}

// RAG Step 2: Data Retrieval & Generation - General
async function retrieveAndGenerateRAGGeneral(userQuery: string, k: number = 5, request: vscode.ChatRequest, token: vscode.CancellationToken): Promise<string> {
    if (!vectorDB) {
        console.error("Vector DB has not been initialized. Make sure indexDataRAG() is properly being called first.");
        return "";
    }

    // Step 1: Embed user query 
    const embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    const embeddings = {
        // embed documents 
        async embedDocuments(texts: string[]): Promise<number[][]> {
            const results = [];
            for (const t of texts) {
                const output = await embedder(t, {pooling: 'mean', normalize: true});
                results.push(Array.from(output.data));
            }
            return results;
        },

        // embed query
        async embedQuery(text: string): Promise<number[]> {
            const output = await embedder(text, {pooling: 'mean', normalize: true});
            return Array.from(output.data);
        }
    }

    const userQueryEmbedding = await embeddings.embedQuery(userQuery);

    // Step 2: Retrieve top-K relevant chunks from vector DB (similarity search; ChromaDB)
    const topKResults = await vectorDB.similaritySearchVectorWithScore(userQueryEmbedding, k);
    console.log("top-K results: \n", topKResults);

    // Step 3: Create prompt for LLM (user query + top-K retrieved chunks)
    const topKChunks = topKResults.map((r: any) => r[0].pageContent);

    const prompt = `
    You are a helpful assistant. Your job is to answer any questions the user may have about Catalyst Center, Ansible, or anything generic that relates to whatever the user asks. 
    Do not provide any code or YAML unless the user specifically asks for it.
    Try to be concise in your response to not overload the user with information. Format the response so it is easier to read.
    Be prepared to answer follow up questions and remember the previous questions and responses in the conversation.

    Here is some relevant information related to the user's prompt that may help you answer the question. HOWEVER, for more general questions, use your knowledge rather than this repo specific knowledge:
    \n${topKChunks}\n

    Here is the user prompt: \n${request.prompt}\n
    `;

    // Step 4: Send prompt to LLM & parse result
    const messages = [vscode.LanguageModelChatMessage.User(prompt)];

    // send request to copilot llm model
    try {
        const chatResponse = await request.model.sendRequest(messages, {}, token)
        let result = '';
        for await (const fragment of chatResponse.text) {
            result += fragment;
        }
        return result;
    } catch (error) {
        console.error("Error answering question with Copilot LLM", error);
    }
    return "Error: Unable to retrieve information. Please try again later.";
}

async function fetchREADMEFiles(): Promise<String> {
    // check if fetched READMEs includes all workflows
    if (workflows.length != 0 && workflows.every((w) => fetchedREADMEs.includes(w))) {
        console.log("DID NOT REFETCH READMES");
        return fetchedREADMEs;
    }
    // else retrieve READMEs from cloned GitHub repository in user's workspace
    fetchedREADMEs = "";
    workflows = [];

    // retrieve all workflows from cloned folder
    const workflowsDir = `${vscode.workspace.rootPath}/updated-catalyst-center-ansible-iac/workflows/`;
    const workflowNames = await fs.readdirSync(workflowsDir);

    // for each workflow, retrieve README file content (if exists)
    let i = 1;
    for (const w of workflowNames) {
        const readmeUri = await vscode.workspace.findFiles(`**/updated-catalyst-center-ansible-iac/workflows/${w}/README.md`);
        if (readmeUri.length) {
            const readme = (await vscode.workspace.fs.readFile(vscode.Uri.file(readmeUri[0].fsPath))).toString();
            // retrieve names of playbooks in workflow
            const uris = await vscode.workspace.findFiles(`**/updated-catalyst-center-ansible-iac/workflows/${w}/playbook/*_playbook.yml`);
            const playbooks = uris.map(uri => uri.fsPath.replace(/^.*[\\/]/, ''));

            // add workflow & README to mapping
            workflowToREADMEs[w] = readme;

            // add information about workflow + playbooks in workflow + readme
            fetchedREADMEs += `Workflow #${i}: ${w} \n`;
            fetchedREADMEs += `Playbooks in workflow: ${playbooks.join(', ')}\n`;
            fetchedREADMEs += `Information about workflow: ${readme.substring(0, 1500)} \n\n`;
        } else {
            fetchedREADMEs += `Workflow #${i}: ${w} \n "" \n\n`;
        }
        workflows.push(w);
        i += 1;
    }

    console.log("number of fetched READMEs: ", i);
    // console.log("fetched READMEs: ", fetchedREADMEs);
    return fetchedREADMEs;
}

export { indexDataRAG, retrieveAndGenerateRAGWorkflow, retrieveAndGenerateRAGGeneral, fetchREADMEFiles };