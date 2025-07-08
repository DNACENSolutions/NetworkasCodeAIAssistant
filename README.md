# NaC Copilot README

VS Code extension that utilizes [Catalyst Center Ansible IaC (Infrastructure as Code)](https://github.com/cisco-en-programmability/catalyst-center-ansible-iac/tree/main) workflows and playbooks to streamline and automate network management on Catalyst Center.

---

# Table of Contents
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Setup](#setup)
- [Examples](#examples)

---

# Features

- <u>**AI-Powered Chat Assistance**</u>
  - **Generate YAML Code:** Use the `@assistant` chat assistant to generate YAML vars files tailored to your task by identifying the best workflow, playbook, and schema.
  - **Ask Questions:** Use the `@assistant /ask` chat command to get answers to general and technical questions about Catalyst Center, Ansible, and related topics.
  - **Validate YAML Code:** Use the `@assistant /validate` chat command to validate YAML code using Yamale, Ansible Lint, and YAMLlint.

- <u>**In-Editor Commands**</u>
  - **Validate & Lint:** Instantly run schema validation and linting on your open vars file, with AI-generated annotations for error fixing.
  - **Run Playbook:** Execute the appropriate Ansible playbook for your task, automatically integrating with your Catalyst Center and generating comprehensive logs.

- <u>**Inline YAML Annotations**</u>
  - Receive inline suggestions and error messages directly in your editor based on validation and linting results.

- <u>**Seamless GitHub Integration**</u>
  - Always access the latest workflows, playbooks, and schemas from the [catalyst-center-ansible-iac](https://github.com/cisco-en-programmability/catalyst-center-ansible-iac) repository.

- <u>**Fast, Context-Aware Responses**</u>
  - Utilizes a Retrieval-Augmented Generation (RAG) approach for rapid, relevant answers.
  - *NOTE:* The first user prompt after activation or after a GitHub re-clone may take up to 30 seconds due to initialization; all other responses are typically delivered in ~3 seconds.


Below is a consolidated table of the provided commands / actions.

| Command / Action                | Location      | Description                                                                 |
|---------------------------------|--------------|-----------------------------------------------------------------------------|
| `@assistant`                    | Chat         | Generate YAML vars files for your task by identifying the best workflow, playbook, and schema. |
| `@assistant /ask`               | Chat         | Get answers to general and technical questions about Catalyst Center, Ansible, and related topics. |
| `@assistant /validate`          | Chat         | Validate YAML code using Yamale, Ansible Lint, and YAMLlint.                |
| Validate & Lint ✔️              | Editor Menu  | Instantly run schema validation and linting on your open vars file, with AI-generated annotations for error fixing. |
| Run Playbook ▶️                 | Editor Menu  | Execute the appropriate Ansible playbook for your task, integrating with Catalyst Center and generating comprehensive logs. |
| Inline YAML Annotations         | Editor       | Receive inline suggestions and error messages based on "Validate & Lint" results. |

---

# Prerequisites

Before continuing, please ensure you have the following prerequisites:
- Access to a Cisco Catalyst Center instance
- Proper network connectivity to utilize and interact with Cisco Catalyst Center

---

# Installation

To install the necessary requirements, first create a virtual environment in terminal using the commands below
```bash
python3 -m venv python3env --prompt "nac-venv"
source python3env/bin/activate
```

Next, download the `requirements.txt` file and run the following command:
```bash
pip install -r requirements.txt
```

---

# Setup

If your project does not already have a `.vscode/settings.json` file, create one in the root of your workspace and set the following variables to the full paths of these executables.

| Setting Name                        | Terminal Command to Find Path | Description                                  |
|-------------------------------------|-------------------------------|----------------------------------------------|
| `nac-copilot.ansibleLintPath`       | `where ansible-lint`          | Path to the `ansible-lint` executable        |
| `nac-copilot.yamalePath`            | `where yamale`                | Path to the `yamale` executable              |
| `nac-copilot.yamlLintPath`          | `where yamllint`              | Path to the `yamllint` executable            |
| `nac-copilot.gitPath`               | `where git`                   | Path to the `git` executable                 |
| `nac-copilot.ansiblePlaybookPath`   | `where ansible-playbook`      | Path to the `ansible-playbook` executable    |
| `nac-copilot.venv`                  | `echo $VIRTUAL_ENV`           | Path to your Python virtual environment      |

**Example `.vscode/settings.json`:**
```json
{
  "nac-copilot.ansibleLintPath": "/usr/local/bin/ansible-lint",
  "nac-copilot.yamalePath": "/usr/local/bin/yamale",
  "nac-copilot.yamlLintPath": "/usr/local/bin/yamllint",
  "nac-copilot.gitPath": "/usr/bin/git",
  "nac-copilot.ansiblePlaybookPath": "/usr/local/bin/ansible-playbook",
  "nac-copilot.venv": "/Users/youruser/your-venv-path"
}
```

Next, download the `hosts.yaml` file and fill in the appropriate variables. 

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
![Run Playbook Example](images/run-playbook.png)