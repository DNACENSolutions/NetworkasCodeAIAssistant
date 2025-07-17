# NaC Copilot README

VS Code extension that utilizes [Catalyst Center Ansible IaC (Infrastructure as Code)](https://github.com/cisco-en-programmability/catalyst-center-ansible-iac/tree/main) workflows and playbooks to streamline and automate network management on Catalyst Center.

---

# Table of Contents
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Setup](#setup)
- [LLM Model Performance - Playbook Classification](#llm-model-performance---playbook-classification)
- [Examples](#examples)

---

# Features

### AI-Powered Chat Assistance
- **Generate YAML Code:** Use the `@assistant` chat assistant to generate YAML vars files tailored to your task by identifying the best workflow, playbook, and schema.
- **Ask Questions:** Use the `@assistant /ask` chat command to get answers to general and technical questions about Catalyst Center, Ansible, and related topics.
- **Validate YAML Code:** Use the `@assistant /validate` chat command to validate YAML code using Yamale, Ansible Lint, and YAMLlint.
- *NOTE:* Make sure to select the "Ask" mode in the GitHub Copilot chat to be able to use these chat commands.

### In-Editor Commands
- **Validate & Lint:** Instantly run schema validation and linting on your currently open vars file, with AI-generated annotations for error fixing.
  - *Note:* This command requires that a vars file is open in the editor.
- **Run Playbook:** Execute the appropriate Ansible playbook for your task by selecting the hosts, playbook, and vars files, with automatic Catalyst Center integration and detailed logs.
  - *Note:* This command requires that a vars file exists in your project.

### Inline YAML Annotations
- Receive inline suggestions and error messages directly in your editor based on validation and linting results.
- This feature is available with the "Validate & Lint" command listed above

### Seamless GitHub Integration
- Always access the latest workflows, playbooks, and schemas from the [catalyst-center-ansible-iac](https://github.com/cisco-en-programmability/catalyst-center-ansible-iac) repository.
- *NOTE:* By default, the most updated version of the `catalyst-center-ansible-iac` repository is cloned. 

### Fast, Context-Aware Responses
- Utilizes a Retrieval Augmented Generation (RAG) approach for rapid, relevant answers.
- *NOTE:* The first user prompt after activation or after a GitHub re-clone may take around 30 seconds due to initialization; all other responses are typically delivered in ~3 seconds.

Below is a consolidated table of the provided commands / actions.

| Command / Action                | Location      | Description                                                                 |
|---------------------------------|--------------|-----------------------------------------------------------------------------|
| `@assistant`                    | Chat         | Generate YAML vars files for your task by identifying the best workflow, playbook, and schema. |
| `@assistant /ask`               | Chat         | Get answers to general and technical questions about Catalyst Center, Ansible, and related topics. |
| `@assistant /validate`          | Chat         | Validate YAML code using Yamale, Ansible Lint, and YAMLlint.                |
| Validate & Lint ✔️              | Editor Menu  | Instantly run schema validation and linting on your open vars file, with AI-generated annotations for error fixing. |
| Run Playbook ▶️                 | Editor Menu  | Execute the appropriate Ansible playbook for your task, integrating with Catalyst Center and generating comprehensive logs. |
| Inline YAML Annotations         | Editor       | Receive inline suggestions and error messages based on "Validate & Lint" results. |

*NOTE:* The `@assistant /validate` command creates a temporary file to run validation on, leaving your original files untouched. 

---

# Important Note

- As mentioned above in the features, the latest version of the `catalyst-center-ansible-iac` repository is automatically cloned into your workspace as `ai-assistant-catalyst-center-ansible-iac`. **Please do not modify this folder**, as it is managed by the extension and used to support its functionality.

---

# Prerequisites

Before continuing, please ensure you have the following prerequisites:
- Access to a Cisco Catalyst Center instance
- Proper network connectivity to utilize and interact with Cisco Catalyst Center

---

# Installation

To install the necessary requirements, first create a Python virtual environment in your project's root directory by running the following commands in your terminal:
```bash
python3 -m venv python3env --prompt "nac-venv"
source python3env/bin/activate
```

Next, download the requirements by running the following command:
```bash
pip install ansible ansible-runner dnacentersdk yamale ansible-lint yamllint jinja2
```

---

# Setup

Download the `hosts.yaml` file and fill in the appropriate variables to integrate your Catalyst Center instance.

Note that if there are spaces in the `ansible_python_interpreter` path, add `\` character in the space. For instance "/Users/dir name/ venv" becomes "Users/dir\ name/venv".

**Example `hosts.yaml`:**
```yaml
---
catalyst_center_hosts:
    hosts:
        catalyst_center220:
            catalyst_center_host: 10.111.222.33
            catalyst_center_password: password
            catalyst_center_port: 443
            catalyst_center_timeout: 60
            catalyst_center_username: user
            catalyst_center_version: 2.3.7.9
            catalyst_center_verify: false
            catalyst_center_debug: true
            catalyst_center_log_level: DEBUG
            catalyst_center_log: true
            catalyst_center_log_append: false
            catalyst_center_log_file_path: "dnac_log.log"
            catalyst_center_api_task_timeout: 1200
            ansible_python_interpreter: '/Users/youruser/your-venv-path/bin/python'
```
- You are now ready to use all the commands and features of this extension! See the [examples](#examples) below for more detailed images of how to use these features.
---

# LLM Model Performance - Playbook Classification
You may choose any Copilot LLM model available. The table below shows performance statistics to help you make an informed decision.

  | Model                 | Average Response Time (s) | Accuracy (%) |
  |-----------------------|---------------------------|------------------------|
  | GPT-4.1 (baseline)    | 8                         | 84.33                  |
  | Claude-3.5 (baseline) | 8                         | 91.79                  |
  | RAG + GPT-4.1         | 3                         | 96.27                  |
  | RAG + Claude-3.5      | 5                         | 96.27                  |

*NOTE:* Claude-3.5 is included with the free version of GitHub Copilot, but GPT-4.1 is only available with the paid version of GitHub Copilot.
---

# Examples

Below are some examples of this extension in action:

## AI-Powered Chat Assistance - Generate YAML code
![Generating YAML Code Example](images/gen-code.png)

## AI-Powered Chat Assistance - Ask questions
![Asking Questions Example](images/q&a.png)

## AI-Powered Chat Assistance - Validate YAML code
![Validating YAML Code Example](images/validate-code.png)

## In-Editor Commands - Validate & Lint Failure with Inline YAML Annotations
![Validate & Lint Failure with Inline Annotations Example](images/validate-lint-fail.png)

## In-Editor Commands - Validate & Lint Success
![Validate & Lint Success Example](images/validate-lint-success.png)

## In-Editor Commands - Run Playbook
![Run Playbook Example - File Searching](images/run-playbook-file-search.png)
![Run Playbook Example](images/run-playbook.png)
