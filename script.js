class Editor {
    constructor() {
        this.tabs = [];
        this.activeTab = null;
        this.folderStructure = null;
        this.currentWorkingDirectory = null;

        this.initializeEditor();
        this.initializeTreeControls();
        this.initializeEventListeners();
        this.initializeSidebarToggles();
        
        // github 
        this.githubToken = localStorage.getItem('githubToken');
        this.initializeGitHubFeatures();
        this.checkGitHubLoginStatus();

        this.initializeSourceControl();
        this.sourceControlChanges = new Map();
        this.stagedChanges = new Map();
        this.originalContents = new Map(); // Add this to track original file contents

    }

    initializeTreeControls() {
        const collapseAllBtn = document.getElementById('collapseAll');
        const expandAllBtn = document.getElementById('expandAll');

        collapseAllBtn?.addEventListener('click', () => this.collapseAllFolders());
        expandAllBtn?.addEventListener('click', () => this.expandAllFolders());
    }

    initializeEditor() {
        this.editor = CodeMirror(document.getElementById('editor'), {
            mode: 'javascript',
            theme: 'monokai',
            lineNumbers: true,
            autoCloseBrackets: true,
            matchBrackets: true,
            indentUnit: 4,
            tabSize: 4,
            indentWithTabs: true,
            lineWrapping: true,
            autofocus: true
        });

        this.editor.on('change', () => {
            const tab = this.tabs.find(t => t.id === this.activeTab);
            if (tab && tab.content !== this.editor.getValue()) {
                tab.isModified = true;
                this.renderTabs();
            }
            this.updateOutliner();
        });

        this.editor.on('change', () => {
            const tab = this.tabs.find(t => t.id === this.activeTab);
            if (tab) {
                this.trackFileChanges();
                this.updateOutliner();
            }
        });
    }

    initializeEventListeners() {
        document.getElementById('newFile').addEventListener('click', () => this.newFile());
        document.getElementById('openFile').addEventListener('click', () => document.getElementById('fileInput').click());
        // document.getElementById('openFolder').addEventListener('click', () => document.getElementById('folderInput').click());
        document.getElementById('openFolder').addEventListener('click', () => {
        if (this.isMobileDevice()) {
            alert('Folder selection is not fully supported on mobile devices. Please use a desktop browser for full functionality.');
            return;
        }
        document.getElementById('folderInput').click();
        });
        document.getElementById('save').addEventListener('click', () => this.save());
        document.getElementById('saveAs').addEventListener('click', () => this.saveAs());
        document.getElementById('fileInput').addEventListener('change', (e) => this.handleFileSelect(e));
        document.getElementById('folderInput').addEventListener('change', (e) => this.handleFolderSelect(e));
        document.getElementById('syntaxSelect').addEventListener('change', (e) => this.changeSyntax(e));
        document.getElementById('closeFolder').addEventListener('click', () => this.closeFolder());
        document.getElementById('collapseAll').addEventListener('click', () => this.collapseAllFolders());
        
        // Edit operations
        document.getElementById('selectAll').addEventListener('click', () => this.editor.execCommand('selectAll'));
        document.getElementById('copy').addEventListener('click', () => this.copyToClipboard());
        document.getElementById('cut').addEventListener('click', () => this.cutToClipboard());
        document.getElementById('paste').addEventListener('click', () => this.pasteFromClipboard());
    }

    initializeSidebarToggles() {
        const toggleFileExplorer = document.getElementById('toggleFileExplorer');
        const toggleOutliner = document.getElementById('toggleOutliner');
        const fileExplorer = document.getElementById('fileExplorer');
        const outliner = document.getElementById('outliner');
        const toggleSidebar = document.getElementById('toggleSidebar');
        const sidebar = document.querySelector('.sidebar');

        toggleFileExplorer.addEventListener('click', () => {
            toggleFileExplorer.classList.toggle('active');
            toggleOutliner.classList.remove('active');
            fileExplorer.classList.toggle('active');
            outliner.classList.remove('active');
        });

        toggleOutliner.addEventListener('click', () => {
            toggleOutliner.classList.toggle('active');
            toggleFileExplorer.classList.remove('active');
            outliner.classList.toggle('active');
            fileExplorer.classList.remove('active');
        });

        toggleSidebar.addEventListener('click', () => {
            sidebar.classList.toggle('show');
        });
    }

    initializeGitHubFeatures() {
        document.getElementById('githubLogin').addEventListener('click', () => this.showGitHubLogin());
        document.getElementById('cloneRepo').addEventListener('click', () => this.showCloneRepo());
        document.getElementById('commitPush').addEventListener('click', () => this.showCommitPush());
        document.getElementById('pullChanges').addEventListener('click', () => this.pullChanges());

        // Modal close button
        document.querySelector('.close').addEventListener('click', () => {
            document.getElementById('githubModal').style.display = 'none';
        });
    }

    initializeSourceControl() {
        // Add to constructor
        this.sourceControlChanges = new Map();
        this.stagedChanges = new Map();
        
        document.getElementById('toggleSourceControl').addEventListener('click', () => {
            document.getElementById('sourceControl').classList.toggle('active');
            document.getElementById('toggleSourceControl').classList.toggle('active');
            document.getElementById('fileExplorer').classList.remove('active');
            document.getElementById('toggleFileExplorer').classList.remove('active');
            document.getElementById('outliner').classList.remove('active');
            document.getElementById('toggleOutliner').classList.remove('active');
        });
    
        document.getElementById('refreshRepo').addEventListener('click', () => this.refreshRepository());
        document.getElementById('changeBranch').addEventListener('click', () => this.showBranchSelector());
        document.getElementById('stageAllChanges').addEventListener('click', () => this.stageAllChanges());
        document.getElementById('unstageAllChanges').addEventListener('click', () => this.unstageAllChanges());
        document.getElementById('commitChanges').addEventListener('click', () => this.commitChanges());
    }

    async refreshRepository() {
        if (!this.currentRepo) return;
    
        try {
            // Fetch current branch
            const branchResponse = await fetch(
                `https://api.github.com/repos/${this.currentRepo.owner}/${this.currentRepo.repo}/branches`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.githubToken}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                }
            );
    
            if (branchResponse.ok) {
                const branches = await branchResponse.json();
                const defaultBranch = branches.find(b => b.name === 'main' || b.name === 'master');
                document.getElementById('currentBranch').textContent = defaultBranch.name;
            }
    
            // Update file changes
            this.updateChangedFiles();
        } catch (error) {
            console.error('Error refreshing repository:', error);
        }
    }

    async showBranchSelector() {
        if (!this.currentRepo) return;
    
        try {
            const response = await fetch(
                `https://api.github.com/repos/${this.currentRepo.owner}/${this.currentRepo.repo}/branches`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.githubToken}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                }
            );
    
            if (response.ok) {
                const branches = await response.json();
                const content = `
                    <div class="branch-selector">
                        <select id="branchSelect">
                            ${branches.map(branch => 
                                `<option value="${branch.name}">${branch.name}</option>`
                            ).join('')}
                        </select>
                        <button onclick="editor.switchBranch()">Switch Branch</button>
                    </div>
                `;
                this.showModal('Switch Branch', content);
            }
        } catch (error) {
            console.error('Error fetching branches:', error);
        }
    }
    
    async switchBranch() {
        const branchName = document.getElementById('branchSelect').value;
        try {
            await this.loadBranch(branchName);
            document.getElementById('currentBranch').textContent = branchName;
            document.getElementById('githubModal').style.display = 'none';
        } catch (error) {
            console.error('Error switching branch:', error);
        }
    }

    updateChangedFiles() {
        const changedFiles = document.getElementById('changedFiles');
        const stagedFiles = document.getElementById('stagedFiles');
        
        changedFiles.innerHTML = '';
        stagedFiles.innerHTML = '';
    
        // Render unstaged changes
        this.sourceControlChanges.forEach((status, path) => {
            const div = this.createFileChangeElement(path, status, false);
            changedFiles.appendChild(div);
        });
    
        // Render staged changes
        this.stagedChanges.forEach((status, path) => {
            const div = this.createFileChangeElement(path, status, true);
            stagedFiles.appendChild(div);
        });
    }
    
    createFileChangeElement(path, status, isStaged) {
        const div = document.createElement('div');
        div.className = 'file-change';
        div.innerHTML = `
            <span class="status status-${status.toLowerCase()}">
                ${this.getStatusIcon(status)}
            </span>
            <span class="name">${path}</span>
            <div class="actions">
                ${isStaged ? 
                    `<button class="icon-button" onclick="editor.unstageFile('${path}')">
                        <i class="fas fa-minus"></i>
                    </button>` :
                    `<button class="icon-button" onclick="editor.stageFile('${path}')">
                        <i class="fas fa-plus"></i>
                    </button>`
                }
            </div>
        `;
        return div;
    }
    
    getStatusIcon(status) {
        switch (status.toLowerCase()) {
            case 'modified': return 'M';
            case 'added': return 'A';
            case 'deleted': return 'D';
            case 'renamed': return 'R';
            default: return '?';
        }
    }
    
    stageFile(path) {
        if (this.sourceControlChanges.has(path)) {
            this.stagedChanges.set(path, this.sourceControlChanges.get(path));
            this.sourceControlChanges.delete(path);
            this.updateChangedFiles();
        }
    }
    
    unstageFile(path) {
        if (this.stagedChanges.has(path)) {
            this.sourceControlChanges.set(path, this.stagedChanges.get(path));
            this.stagedChanges.delete(path);
            this.updateChangedFiles();
        }
    }
    
    stageAllChanges() {
        this.sourceControlChanges.forEach((status, path) => {
            this.stagedChanges.set(path, status);
        });
        this.sourceControlChanges.clear();
        this.updateChangedFiles();
    }
    
    unstageAllChanges() {
        this.stagedChanges.forEach((status, path) => {
            this.sourceControlChanges.set(path, status);
        });
        this.stagedChanges.clear();
        this.updateChangedFiles();
    }
    
    // Update the commitChanges method
    async commitChanges() { 
        if (this.stagedChanges.size === 0) {
            alert('No changes staged for commit');
            return;
        }

        const message = document.getElementById('commitMessage').value.trim();
        if (!message) {
            alert('Please enter a commit message');
            return;
        }

        try {
            for (const [path] of this.stagedChanges) {
                const content = this.editor.getValue();
                const contentBase64 = btoa(unescape(encodeURIComponent(content)));
                const tab = this.tabs.find(t => t.path === path);

                if (tab && tab.repo) {
                    const [owner, repo] = tab.repo.split('/');
                    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
                        method: 'PUT',
                        headers: {
                            'Authorization': `Bearer ${this.githubToken}`,
                            'Accept': 'application/vnd.github.v3+json',
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            message: message,
                            content: contentBase64,
                            sha: tab.sha
                        })
                    });

                    if (response.ok) {
                        const data = await response.json();
                        tab.sha = data.content.sha;
                        this.originalContents.set(path, content);
                    }
                }
            }

            // Clear staged changes after successful commit
            this.stagedChanges.clear();
            this.updateChangedFiles();
            document.getElementById('commitMessage').value = '';

            // Update tabs
            this.tabs.forEach(tab => {
                if (tab.isModified) {
                    tab.isModified = false;
                }
            });
            this.renderTabs();

            alert('Changes committed successfully!');
        } catch (error) {
            console.error('Error committing changes:', error);
            alert('Failed to commit changes: ' + error.message);
        }
    }

    async checkGitHubLoginStatus() {
        if (this.githubToken) {
            try {
                const response = await fetch('https://api.github.com/user', {
                    headers: {
                        'Authorization': `Bearer ${this.githubToken}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                });

                const data = await response.json();

                if (response.ok) {
                    console.log('GitHub token still valid:', data);
                    document.getElementById('githubLogin').innerHTML = `<i class="fab fa-github"></i> ${data.login}`;
                } else {
                    console.log('GitHub token invalid:', data);
                    localStorage.removeItem('githubToken');
                    this.githubToken = null;
                }
            } catch (error) {
                console.error('Error checking GitHub status:', error);
                localStorage.removeItem('githubToken');
                this.githubToken = null;
            }
        }
    }

    trackFileChanges() {
        const tab = this.tabs.find(t => t.id === this.activeTab);
        if (!tab || !tab.path) return;
    
        const currentContent = this.editor.getValue();
        const originalContent = this.originalContents.get(tab.path);
    
        if (currentContent !== originalContent) {
            if (!this.sourceControlChanges.has(tab.path) && !this.stagedChanges.has(tab.path)) {
                this.sourceControlChanges.set(tab.path, 'modified');
                this.updateChangedFiles();
            }
            tab.isModified = true;
        } else {
            this.sourceControlChanges.delete(tab.path);
            this.stagedChanges.delete(tab.path);
            tab.isModified = false;
            this.updateChangedFiles();
        }
        
        this.renderTabs();
    }

    showModal(title, content) {
        document.getElementById('modalTitle').textContent = title;
        document.getElementById('modalBody').innerHTML = content;
        document.getElementById('githubModal').style.display = 'block';
    }

    showGitHubLogin() {
        const content = `
            <div class="github-form">
                <p>Enter your GitHub Personal Access Token with 'repo' scope.</p>
                <input type="text" id="githubTokenInput" 
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx" 
                    class="github-token-input">
                <p class="token-help">
                    To create a token: 
                    <ol>
                        <li>Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)</li>
                        <li>Click "Generate new token (classic)"</li>
                        <li>Select the "repo" scope</li>
                        <li>Generate and copy the token</li>
                    </ol>
                </p>
                <button onclick="editor.handleGitHubLogin()">Login</button>
            </div>
        `;
        this.showModal('GitHub Login', content);
    }

    async handleGitHubLogin() {
        const token = document.getElementById('githubTokenInput').value.trim();
        if (!token) {
            alert('Please enter a GitHub token');
            return;
        }
    
        try {
            const response = await fetch('https://api.github.com/user', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
    
            const data = await response.json();
    
            if (response.ok) {
                console.log('GitHub login successful:', data);
                this.githubToken = token;
                localStorage.setItem('githubToken', token);
                document.getElementById('githubModal').style.display = 'none';
                
                // Update UI to show logged-in state
                document.getElementById('githubLogin').innerHTML = `<i class="fab fa-github"></i> ${data.login}`;
                alert(`Successfully logged in as ${data.login}!`);
            } else {
                console.error('GitHub login failed:', data);
                alert(`Login failed: ${data.message}`);
            }
        } catch (error) {
            console.error('GitHub login error:', error);
            alert('Failed to login to GitHub. Check console for details.');
        }
    }

    showCloneRepo() {
        if (!this.githubToken) {
            alert('Please login to GitHub first!');
            return;
        }

        const content = `
            <div class="github-form">
                <input type="text" id="repoUrl" placeholder="Repository URL">
                <button onclick="editor.handleCloneRepo()">Clone</button>
            </div>
        `;
        this.showModal('Clone Repository', content);
    }

    
    async handleCloneRepo() {
        const repoUrl = document.getElementById('repoUrl').value.trim();
        if (!repoUrl) return;
    
        try {
            // Extract owner and repo from URL
            const [, owner, repo] = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
            
            // Show loading state
            document.getElementById('modalBody').innerHTML = '<p>Cloning repository...</p>';
            
            // Fetch repository contents
            const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/main?recursive=1`, {
                headers: {
                    'Authorization': `Bearer ${this.githubToken}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
    
            if (response.ok) {
                const data = await response.json();
                this.currentRepo = {
                    owner,
                    repo,
                    tree: data.tree
                };
                
                // Clear existing folder structure
                this.repoFiles = new Map();
                
                // Process and display the repository structure
                await this.processRepoTree(data.tree);
                
                // Switch to file explorer tab and show the repository structure
                document.getElementById('sourceControl').classList.remove('active');
                document.getElementById('toggleSourceControl').classList.remove('active');
                document.getElementById('outliner').classList.remove('active');
                document.getElementById('toggleOutliner').classList.remove('active');
                document.getElementById('fileExplorer').classList.add('active');
                document.getElementById('toggleFileExplorer').classList.add('active');
                
                this.displayRepoStructure();
                
                // Close the modal
                document.getElementById('githubModal').style.display = 'none';
                
                // Show the close folder button
                document.getElementById('closeFolder').style.display = 'block';
    
                // Refresh repository info in source control
                this.refreshRepository();
            } else {
                throw new Error('Failed to fetch repository contents');
            }
        } catch (error) {
            console.error('Clone error:', error);
            alert('Failed to clone repository: ' + error.message);
        }
    }

    displayRepoStructure() {
        const folderStructure = document.querySelector('.folder-structure');
        folderStructure.innerHTML = '';
    
        // Create root folder with repository name
        const rootFolder = document.createElement('div');
        rootFolder.className = 'folder';
        rootFolder.innerHTML = `
            <div class="folder-header">
                <i class="fas fa-chevron-down"></i>
                <i class="fas fa-folder-open"></i>
                <span>${this.currentRepo.repo}</span>
            </div>
            <div class="folder-content expanded"></div>
        `;
        folderStructure.appendChild(rootFolder);
    
        // Create nested structure
        const structure = this.createFileStructure();
        this.renderFileStructure(structure, rootFolder.querySelector('.folder-content'));
    }

    createFileStructure() {
        const structure = {};
        for (const [path] of this.repoFiles) {
            const parts = path.split('/');
            let current = structure;
            
            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
                if (i === parts.length - 1) {
                    // It's a file
                    current[part] = path;
                } else {
                    // It's a directory
                    if (!current[part]) {
                        current[part] = {};
                    }
                    current = current[part];
                }
            }
        }
        return structure;
    }

    async openGitHubFile(path) {
        const content = await this.loadFileContent(path);
        if (content !== null) {
            const fileInfo = this.repoFiles.get(path);
            const fileName = path.split('/').pop();
            const newTab = {
                id: Date.now(),
                title: fileName,
                content: content,
                path: path,
                repo: `${this.currentRepo.owner}/${this.currentRepo.repo}`,
                sha: fileInfo.sha,
                isModified: false
            };
            
            this.originalContents.set(path, content);
            this.tabs.push(newTab);
            this.setActiveTab(newTab.id);
            this.renderTabs();
        }
    }

    async processRepoTree(tree) {
        for (const item of tree) {
            this.repoFiles.set(item.path, {
                ...item,
                content: null,
                loaded: false
            });
        }
    }


    renderFileStructure(structure, parentElement) {
        // Sort items so folders come first, then files
        const items = Object.entries(structure).sort(([nameA, valueA], [nameB, valueB]) => {
            const isFileA = typeof valueA === 'string';
            const isFileB = typeof valueB === 'string';
            if (isFileA === isFileB) return nameA.localeCompare(nameB);
            return isFileA ? 1 : -1;
        });
    
        for (const [name, value] of items) {
            if (typeof value === 'string') {
                // It's a file
                const fileDiv = document.createElement('div');
                fileDiv.className = 'folder-item file';
                fileDiv.innerHTML = `
                    <i class="${this.getFileIcon(name)}"></i>
                    <span>${name}</span>
                `;
                fileDiv.dataset.path = value;
                fileDiv.addEventListener('click', () => this.openGitHubFile(value));
                parentElement.appendChild(fileDiv);
            } else {
                // It's a folder
                const folderDiv = document.createElement('div');
                folderDiv.className = 'folder';
                folderDiv.innerHTML = `
                    <div class="folder-header">
                        <i class="fas fa-chevron-right"></i>
                        <i class="fas fa-folder"></i>
                        <span>${name}</span>
                    </div>
                    <div class="folder-content"></div>
                `;
                parentElement.appendChild(folderDiv);
                
                // Add click handler for folder
                const header = folderDiv.querySelector('.folder-header');
                const content = folderDiv.querySelector('.folder-content');
                const chevron = header.querySelector('.fas.fa-chevron-right');
                const folderIcon = header.querySelector('.fas.fa-folder');
                
                header.addEventListener('click', () => {
                    const isExpanded = content.classList.toggle('expanded');
                    chevron.classList.toggle('fa-chevron-right', !isExpanded);
                    chevron.classList.toggle('fa-chevron-down', isExpanded);
                    folderIcon.classList.toggle('fa-folder', !isExpanded);
                    folderIcon.classList.toggle('fa-folder-open', isExpanded);
                });
    
                // Render folder contents
                this.renderFileStructure(value, content);
            }
        }
    }

    async loadFileContent(path) {
        const fileInfo = this.repoFiles.get(path);
        if (!fileInfo || fileInfo.loaded) return fileInfo?.content;
    
        try {
            const response = await fetch(`https://api.github.com/repos/${this.currentRepo.owner}/${this.currentRepo.repo}/git/blobs/${fileInfo.sha}`, {
                headers: {
                    'Authorization': `Bearer ${this.githubToken}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
    
            if (response.ok) {
                const data = await response.json();
                const content = atob(data.content);
                fileInfo.content = content;
                fileInfo.loaded = true;
                this.repoFiles.set(path, fileInfo);
                return content;
            }
        } catch (error) {
            console.error('Error loading file content:', error);
        }
        return null;
    }

    async processRepoContents(contents, owner, repo, path = '') {
        for (const item of contents) {
            if (item.type === 'file') {
                const response = await fetch(item.download_url);
                const content = await response.text();
                
                const newTab = {
                    id: Date.now(),
                    title: item.name,
                    content: content,
                    path: path + item.name,
                    repo: `${owner}/${repo}`,
                    sha: item.sha,
                    isModified: false
                };
                
                this.tabs.push(newTab);
            } else if (item.type === 'dir') {
                const response = await fetch(item.url, {
                    headers: {
                        'Authorization': `token ${this.githubToken}`
                    }
                });
                const dirContents = await response.json();
                await this.processRepoContents(dirContents, owner, repo, `${path}${item.name}/`);
            }
        }
        
        if (path === '') {
            this.setActiveTab(this.tabs[0].id);
        }
    }

    showCommitPush() {
        if (!this.githubToken) {
            alert('Please login to GitHub first!');
            return;
        }

        const content = `
            <div class="github-form">
                <input type="text" id="commitMessage" placeholder="Commit message">
                <button onclick="editor.handleCommitPush()">Commit & Push</button>
            </div>
        `;
        this.showModal('Commit & Push', content);
    }

    async handleCommitPush() {
        const commitMessage = document.getElementById('commitMessage').value;
        if (!commitMessage) return;

        try {
            for (const tab of this.tabs) {
                if (tab.isModified && tab.repo) {
                    const [owner, repo] = tab.repo.split('/');
                    
                    // Get the current file content
                    const content = this.editor.getValue();
                    const contentBase64 = btoa(content);

                    // Create or update file
                    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${tab.path}`, {
                        method: 'PUT',
                        headers: {
                            'Authorization': `token ${this.githubToken}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            message: commitMessage,
                            content: contentBase64,
                            sha: tab.sha
                        })
                    });

                    if (response.ok) {
                        const data = await response.json();
                        tab.sha = data.content.sha;
                        tab.isModified = false;
                    }
                }
            }
            
            this.renderTabs();
            document.getElementById('githubModal').style.display = 'none';
            alert('Successfully pushed changes!');
        } catch (error) {
            console.error('Push error:', error);
            alert('Failed to push changes');
        }
    }

    async pullChanges() {
        if (!this.githubToken) {
            alert('Please login to GitHub first!');
            return;
        }

        try {
            for (const tab of this.tabs) {
                if (tab.repo) {
                    const [owner, repo] = tab.repo.split('/');
                    
                    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${tab.path}`, {
                        headers: {
                            'Authorization': `token ${this.githubToken}`
                        }
                    });

                    if (response.ok) {
                        const data = await response.json();
                        if (data.sha !== tab.sha) {
                            const content = atob(data.content);
                            tab.content = content;
                            tab.sha = data.sha;
                            if (tab.id === this.activeTab) {
                                this.editor.setValue(content);
                            }
                        }
                    }
                }
            }
            
            alert('Successfully pulled changes!');
        } catch (error) {
            console.error('Pull error:', error);
            alert('Failed to pull changes');
        }
    }


    collapseAllFolders() {
        // Get all expanded folder contents
        const expandedContents = document.querySelectorAll('.folder-content');
        const folderHeaders = document.querySelectorAll('.folder-header');

        // Collapse all folders
        expandedContents.forEach(content => {
            content.classList.remove('expanded');
        });

        // Update all folder icons
        folderHeaders.forEach(header => {
            const chevron = header.querySelector('.fas.fa-chevron-down, .fas.fa-chevron-right');
            const folderIcon = header.querySelector('.fas.fa-folder-open, .fas.fa-folder');
            
            if (chevron) {
                chevron.classList.remove('fa-chevron-down');
                chevron.classList.add('fa-chevron-right');
            }
            
            if (folderIcon) {
                folderIcon.classList.remove('fa-folder-open');
                folderIcon.classList.add('fa-folder');
            }
        });
    }

    expandAllFolders() {
        // Get all folder contents
        const folderContents = document.querySelectorAll('.folder-content');
        const folderHeaders = document.querySelectorAll('.folder-header');

        // Expand all folders
        folderContents.forEach(content => {
            content.classList.add('expanded');
        });

        // Update all folder icons
        folderHeaders.forEach(header => {
            const chevron = header.querySelector('.fas.fa-chevron-down, .fas.fa-chevron-right');
            const folderIcon = header.querySelector('.fas.fa-folder-open, .fas.fa-folder');
            
            if (chevron) {
                chevron.classList.remove('fa-chevron-right');
                chevron.classList.add('fa-chevron-down');
            }
            
            if (folderIcon) {
                folderIcon.classList.remove('fa-folder');
                folderIcon.classList.add('fa-folder-open');
            }
        });
    }

    closeFolder() {
        this.folderStructure = null;
        this.currentWorkingDirectory = null;
        this.currentRepo = null;
        this.repoFiles = new Map();
        document.querySelector('.folder-structure').innerHTML = '';
        document.getElementById('closeFolder').style.display = 'none';
        
        // Reset source control
        document.getElementById('currentBranch').textContent = 'main';
        document.getElementById('changedFiles').innerHTML = '';
        document.getElementById('stagedFiles').innerHTML = '';
    }

    async handleFolderSelect(event) {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    try {
        // Show loading indicator
        this.showLoadingIndicator();

        this.currentWorkingDirectory = event.target.files[0].webkitRelativePath.split('/')[0];
        document.getElementById('closeFolder').style.display = 'block';

        // Create folder structure
        this.folderStructure = {
            type: 'folder',
            name: this.currentWorkingDirectory,
            children: {}
        };

        // Process files in chunks
        const CHUNK_SIZE = 50; // Adjust this number based on performance
        for (let i = 0; i < files.length; i += CHUNK_SIZE) {
            const chunk = files.slice(i, i + CHUNK_SIZE);
            await this.processFileChunk(chunk);
            
            // Update loading progress
            this.updateLoadingProgress(i + chunk.length, files.length);
            
            // Allow UI to update
            await new Promise(resolve => setTimeout(resolve, 0));
        }

        this.renderFolderStructure();
        event.target.value = '';
        
        // Hide loading indicator
        this.hideLoadingIndicator();
        } catch (error) {
        console.error('Error loading folder:', error);
        this.hideLoadingIndicator();
        alert('Error loading folder: ' + error.message);
        }
    }

    // Add these helper methods to your Editor class
async processFileChunk(files) {
    for (const file of files) {
        try {
            const pathParts = file.webkitRelativePath.split('/');
            let currentLevel = this.folderStructure;

            // Skip files larger than 5MB
            if (file.size > 5 * 1024 * 1024) {
                console.warn(`Skipping large file: ${file.name}`);
                continue;
            }

            // Skip binary files
            if (this.isBinaryFile(file)) {
                console.warn(`Skipping binary file: ${file.name}`);
                continue;
            }

            // Process the file path
            for (let i = 1; i < pathParts.length; i++) {
                const part = pathParts[i];
                
                if (i === pathParts.length - 1) {
                    // It's a file
                    const content = await this.readFileWithTimeout(file);
                    currentLevel.children[part] = {
                        type: 'file',
                        name: part,
                        content: content,
                        path: file.webkitRelativePath
                    };
                } else {
                    // It's a folder
                    if (!currentLevel.children[part]) {
                        currentLevel.children[part] = {
                            type: 'folder',
                            name: part,
                            children: {}
                        };
                    }
                    currentLevel = currentLevel.children[part];
                }
            }
        } catch (error) {
            console.warn(`Error processing file ${file.name}:`, error);
        }
    }
}

isBinaryFile(file) {
    const binaryExtensions = [
        '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.ico', '.pdf', 
        '.doc', '.docx', '.xls', '.xlsx', '.zip', '.rar', '.7z',
        '.exe', '.dll', '.so', '.dylib', '.class'
    ];
    
    return binaryExtensions.some(ext => 
        file.name.toLowerCase().endsWith(ext)
    );
}

async readFileWithTimeout(file, timeout = 5000) {
    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            reject(new Error('File reading timed out'));
        }, timeout);

        const reader = new FileReader();
        reader.onload = (e) => {
            clearTimeout(timeoutId);
            resolve(e.target.result);
        };
        reader.onerror = (e) => {
            clearTimeout(timeoutId);
            reject(e);
        };
        reader.readAsText(file);
    });
}

showLoadingIndicator() {
    // Create loading indicator if it doesn't exist
    if (!document.getElementById('loadingIndicator')) {
        const loadingHTML = `
            <div id="loadingIndicator" class="loading-overlay">
                <div class="loading-content">
                    <div class="loading-spinner"></div>
                    <div class="loading-text">Loading folder...</div>
                    <div class="loading-progress">0%</div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', loadingHTML);
    }
    document.getElementById('loadingIndicator').style.display = 'flex';
}

hideLoadingIndicator() {
    const indicator = document.getElementById('loadingIndicator');
    if (indicator) {
        indicator.style.display = 'none';
    }
}

updateLoadingProgress(current, total) {
    const progress = document.querySelector('#loadingIndicator .loading-progress');
    if (progress) {
        const percentage = Math.round((current / total) * 100);
        progress.textContent = `${percentage}%`;
    }
}
    
    renderFolderStructure(structure = this.folderStructure, container = document.querySelector('.folder-structure')) {
        if (!structure) return;
        container.innerHTML = '';
        this.renderFolderItem(structure, container);
    }

    renderFolderItem(item, container) {
        const itemElement = document.createElement('div');
        itemElement.className = 'folder-item';
        
        const icon = document.createElement('i');
        const nameSpan = document.createElement('span');
        nameSpan.textContent = item.name;
        
        if (item.type === 'folder') {
            icon.className = 'fas fa-folder';
            itemElement.appendChild(icon);
            itemElement.appendChild(nameSpan);
            
            const childrenContainer = document.createElement('div');
            childrenContainer.className = 'folder-children';
            
            itemElement.addEventListener('click', (e) => {
                e.stopPropagation();
                childrenContainer.classList.toggle('expanded');
                icon.classList.toggle('fa-folder');
                icon.classList.toggle('fa-folder-open');
            });
            
            const sortedChildren = Object.entries(item.children)
                .sort(([,a], [,b]) => {
                    if (a.type === b.type) return a.name.localeCompare(b.name);
                    return a.type === 'folder' ? -1 : 1;
                });

            for (const [, child] of sortedChildren) {
                this.renderFolderItem(child, childrenContainer);
            }
            
            container.appendChild(itemElement);
            container.appendChild(childrenContainer);
        } else {
            itemElement.classList.add('file');
            icon.className = this.getFileIcon(item.name);
            itemElement.appendChild(icon);
            itemElement.appendChild(nameSpan);
            
            itemElement.addEventListener('click', () => {
                this.openFileFromStructure(item);
            });
            
            container.appendChild(itemElement);
        }
    }

    getFileIcon(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        switch (ext) {
            case 'js':
                return 'fab fa-js text-yellow';
            case 'html':
                return 'fab fa-html5 text-orange';
            case 'css':
                return 'fab fa-css3 text-blue';
            case 'py':
                return 'fab fa-python text-blue';
            case 'md':
                return 'fas fa-file-alt text-white';
            case 'json':
                return 'fas fa-code text-yellow';
            case 'jpg':
            case 'jpeg':
            case 'png':
            case 'gif':
                return 'fas fa-image text-purple';
            case 'pdf':
                return 'fas fa-file-pdf text-red';
            default:
                return 'fas fa-file text-gray';
        }
    }

    getSyntaxMode(filename) {
        const extension = filename.split('.').pop().toLowerCase();
        switch (extension) {
            case 'html': return 'xml';
            case 'css': return 'css';
            case 'js': return 'javascript';
            case 'py': return 'python';
            case 'md': return 'markdown';
            case 'json': return 'javascript';
            case 'godot': return 'javascript'; // Using JavaScript mode for GDScript as fallback
            default: return 'javascript';
        }
    }

    getFileType(filename) {
        const extensionMap = {
            // Web Development
            'js': 'javascript',
            'jsx': 'javascript',
            'ts': 'javascript',
            'tsx': 'javascript',
            'html': 'xml',
            'htm': 'xml',
            'xml': 'xml',
            'svg': 'xml',
            'css': 'css',
            'scss': 'css',
            'less': 'css',
            
            // Programming Languages
            'py': 'python',
            'python': 'python',
            'rb': 'ruby',
            'php': 'php',
            'java': 'java',
            'c': 'clike',
            'cpp': 'clike',
            'cs': 'clike',
            'h': 'clike',
            'hpp': 'clike',
            
            // Data & Config
            'json': 'javascript',
            'yaml': 'yaml',
            'yml': 'yaml',
            'toml': 'toml',
            
            // Documentation
            'md': 'markdown',
            'markdown': 'markdown',
            'txt': 'text',
            
            // Game Development
            'gd': 'javascript', // GDScript (using JavaScript mode as fallback)
            
            // Default
            'default': 'javascript'
        };
    
        const ext = filename.split('.').pop().toLowerCase();
        return extensionMap[ext] || extensionMap.default;
    }

    updateSyntaxHighlighting(filename) {
        const mode = this.getFileType(filename);
        this.editor.setOption('mode', mode);
        
        // Update syntax select dropdown
        const syntaxSelect = document.getElementById('syntaxSelect');
        if (syntaxSelect) {
            // Check if the option exists
            const option = Array.from(syntaxSelect.options).find(opt => opt.value === mode);
            if (option) {
                syntaxSelect.value = mode;
            }
        }
    }

    async openFileFromStructure(fileItem) {
        const existingTab = this.tabs.find(tab => tab.path === fileItem.path);
        if (existingTab) {
            this.setActiveTab(existingTab.id);
            return;
        }
    
        const newTab = {
            id: Date.now(),
            title: fileItem.name,
            content: fileItem.content,
            path: fileItem.path,
            isModified: false
        };
    
        this.tabs.push(newTab);
        this.setActiveTab(newTab.id);
    }

    async readFile(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.readAsText(file);
        });
    }

    newFile() {
        const newTab = {
            id: Date.now(),
            title: 'untitled',
            content: '',
            isModified: false
        };
        this.tabs.push(newTab);
        this.setActiveTab(newTab.id);
    }

    async handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;
    
        const content = await this.readFile(file);
        const newTab = {
            id: Date.now(),
            title: file.name,
            content: content,
            path: file.path,
            isModified: false
        };
    
        this.tabs.push(newTab);
        this.setActiveTab(newTab.id);
        event.target.value = '';
    }

    changeSyntax(event) {
        const mode = event.target.value;
        this.editor.setOption('mode', mode);
        
        // Update the current tab's file type if needed
        const tab = this.tabs.find(t => t.id === this.activeTab);
        if (tab && tab.title) {
            // Optionally update the file extension based on the new syntax
            // This is if you want to change the file type permanently
            // tab.title = this.updateFileExtension(tab.title, mode);
            // this.renderTabs();
        }
    }

    setActiveTab(id) {
        this.activeTab = id;
        const tab = this.tabs.find(t => t.id === id);
        if (tab) {
            this.editor.setValue(tab.content);
            // Update syntax highlighting based on file name
            if (tab.title) {
                this.updateSyntaxHighlighting(tab.title);
            }
        }
        this.renderTabs();
        this.updateOutliner();
    }

    renderTabs() {
        const tabsContainer = document.getElementById('tabs');
        tabsContainer.innerHTML = '';

        this.tabs.forEach(tab => {
            const tabElement = document.createElement('div');
            tabElement.className = `tab ${tab.id === this.activeTab ? 'active' : ''}`;
            
            const titleSpan = document.createElement('span');
            titleSpan.className = 'tab-title';
            titleSpan.textContent = `${tab.title}${tab.isModified ? '*' : ''}`;
            
            const closeButton = document.createElement('span');
            closeButton.className = 'tab-close';
            closeButton.innerHTML = '&times;';
            
            tabElement.appendChild(titleSpan);
            tabElement.appendChild(closeButton);
            
            tabElement.addEventListener('click', () => this.setActiveTab(tab.id));
            closeButton.addEventListener('click', (e) => {
                e.stopPropagation();
                this.closeTab(tab.id);
            });
            
            tabsContainer.appendChild(tabElement);
        });
    }

    closeTab(id) {
        const index = this.tabs.findIndex(t => t.id === id);
        if (index === -1) return;

        this.tabs.splice(index, 1);
        
        if (this.activeTab === id) {
            if (this.tabs.length > 0) {
                this.setActiveTab(this.tabs[this.tabs.length - 1].id);
            } else {
                this.activeTab = null;
                this.editor.setValue('');
            }
        }
        
        this.renderTabs();
    }

    updateOutliner() {
        const outlineStructure = document.querySelector('.outline-structure');
        outlineStructure.innerHTML = '';
    
        const content = this.editor.getValue();
        const mode = this.editor.getOption('mode');
    
        let items = [];
        switch (mode) {
            case 'javascript':
                items = this.parseJavaScript(content);
                break;
            case 'xml':
            case 'htmlmixed':
                items = this.parseHTML(content);
                break;
            case 'css':
                items = this.parseCSS(content);
                break;
            default:
                outlineStructure.innerHTML = '<div class="no-outline">No outline available</div>';
                return;
        }
    
        items.forEach(item => {
            const itemElement = document.createElement('div');
            itemElement.className = 'outline-item';
            
            // Apply indentation based on level
            itemElement.style.paddingLeft = `${item.level * 20 + 8}px`;
            
            const nameSpan = document.createElement('span');
            nameSpan.textContent = item.name;
            nameSpan.className = `outline-name ${item.type}`;
            
            itemElement.appendChild(nameSpan);
            
            itemElement.addEventListener('click', () => {
                if (item.line !== undefined) {
                    this.editor.setCursor(item.line - 1);
                    this.editor.focus();
                }
            });
            
            outlineStructure.appendChild(itemElement);
        });
    }

    parseJavaScript(content) {
        const items = [];
        const lines = content.split('\n');
        let currentClass = null;
        let bracketCount = 0;
        let classLevel = 0;
    
        const addOutlineItem = (name, type, line, level = 0) => {
            items.push({
                name: `${getIconForType(type)} ${name}`,
                type,
                line,
                level
            });
        };
    
        const getIconForType = (type) => {
            switch(type) {
                case 'class': return '📦';
                case 'constructor': return '🔨';
                case 'async-method':
                case 'async-function': return '⚡';
                case 'method':
                case 'function': return '🔹';
                case 'static-method': return '🔒';
                case 'variable-function': return '➜';
                default: return '•';
            }
        };
    
        const isInsideFunction = () => bracketCount > (currentClass ? classLevel + 1 : 1);
    
        lines.forEach((line, index) => {
            const trimmedLine = line.trim();
    
            // Track brackets
            const openBrackets = (trimmedLine.match(/{/g) || []).length;
            const closeBrackets = (trimmedLine.match(/}/g) || []).length;
            bracketCount += openBrackets - closeBrackets;
    
            // Skip if we're inside a function body
            if (isInsideFunction()) return;
    
            // Class declarations
            const classMatch = trimmedLine.match(/^class\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/);
            if (classMatch) {
                currentClass = classMatch[1];
                classLevel = bracketCount;
                addOutlineItem(classMatch[1], 'class', index + 1, 0);
                return;
            }
    
            // Constructor in class
            if (currentClass && trimmedLine.startsWith('constructor')) {
                addOutlineItem('constructor', 'constructor', index + 1, 1);
                return;
            }
    
            // Methods (including async)
            const methodMatch = trimmedLine.match(/^(async\s+)?([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\([^)]*\)\s*{?/);
            if (methodMatch && !trimmedLine.startsWith('function') && !trimmedLine.includes('=>')) {
                const methodName = methodMatch[2];
                const isAsync = !!methodMatch[1];
                
                addOutlineItem(
                    methodName,
                    isAsync ? 'async-method' : 'method',
                    index + 1,
                    currentClass ? 1 : 0
                );
                return;
            }
    
            // Function declarations
            const functionMatch = trimmedLine.match(/^(async\s+)?function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/);
            if (functionMatch) {
                const isAsync = !!functionMatch[1];
                addOutlineItem(
                    functionMatch[2],
                    isAsync ? 'async-function' : 'function',
                    index + 1,
                    0
                );
                return;
            }
    
            // Static methods
            const staticMatch = trimmedLine.match(/^static\s+(async\s+)?([a-zA-Z_$][a-zA-Z0-9_$]*)/);
            if (staticMatch && currentClass) {
                const isAsync = !!staticMatch[1];
                addOutlineItem(
                    staticMatch[2],
                    isAsync ? 'static-async-method' : 'static-method',
                    index + 1,
                    1
                );
                return;
            }
    
            // Variable declarations with function assignments
            const varFuncMatch = trimmedLine.match(/^(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(async\s+)?(\([^)]*\)\s*=>|function)/);
            if (varFuncMatch) {
                const isAsync = !!varFuncMatch[2];
                addOutlineItem(
                    varFuncMatch[1],
                    isAsync ? 'async-variable-function' : 'variable-function',
                    index + 1,
                    0
                );
            }
        });
    
        return items;
    }

    parseHTML(content) {
        const items = [];
        const lines = content.split('\n');
        
        lines.forEach((line, index) => {
            // Match elements with id or class
            const elementMatch = line.match(/<([a-z0-9]+)([^>]*?)(id|class)=["']([^"']+)["'][^>]*>/i);
            if (elementMatch) {
                const tag = elementMatch[1];
                const attr = elementMatch[3];
                const value = elementMatch[4];
                items.push({
                    name: `<${tag}> ${attr === 'id' ? '#' : '.'}${value}`,
                    icon: 'fas fa-code',
                    line: index + 1
                });
            }
    
            // Match headings
            const headingMatch = line.match(/<h([1-6])[^>]*>(.*?)<\/h\1>/i);
            if (headingMatch) {
                items.push({
                    name: `H${headingMatch[1]}: ${headingMatch[2]}`,
                    icon: 'fas fa-heading',
                    line: index + 1
                });
            }
        });
        
        return items;
    }

    parseCSS(content) {
        const items = [];
        const lines = content.split('\n');
        let currentLine = 0;
        
        while (currentLine < lines.length) {
            const line = lines[currentLine].trim();
            
            // Match CSS selectors
            if (line && !line.startsWith('@') && !line.startsWith('}')) {
                const selectorMatch = line.split('{')[0].trim();
                if (selectorMatch) {
                    items.push({
                        name: selectorMatch,
                        icon: 'fas fa-paint-brush',
                        line: currentLine + 1
                    });
                }
            }
            
            currentLine++;
        }
        
        return items;
    }

    // Update the save method to handle GitHub files
    async save() {
        const tab = this.tabs.find(t => t.id === this.activeTab);
        if (!tab) return;

        if (tab.repo && this.githubToken) {
            try {
                const content = this.editor.getValue();
                const contentBase64 = btoa(unescape(encodeURIComponent(content)));
                const [owner, repo] = tab.repo.split('/');

                const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${tab.path}`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${this.githubToken}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        message: `Update ${tab.path}`,
                        content: contentBase64,
                        sha: tab.sha
                    })
                });

                if (response.ok) {
                    const data = await response.json();
                    tab.sha = data.content.sha;
                    this.originalContents.set(tab.path, content);

                    // Move from changed to staged
                    if (this.sourceControlChanges.has(tab.path)) {
                        this.stagedChanges.set(tab.path, 'modified');
                        this.sourceControlChanges.delete(tab.path);
                    }

                    this.updateChangedFiles();
                    tab.isModified = false;
                    this.renderTabs();
                } else {
                    throw new Error('Failed to save file');
                }
            } catch (error) {
                console.error('Save error:', error);
                alert('Failed to save file: ' + error.message);
            }
        } else if (!tab.path) {
            await this.saveAs();
        } else {
            // Existing local file save logic
            tab.content = this.editor.getValue();
            tab.isModified = false;
            this.renderTabs();
        }
    }

    

    async saveAs() {
        const tab = this.tabs.find(t => t.id === this.activeTab);
        if (!tab) return;
    
        // Create a Blob with the file content
        const blob = new Blob([this.editor.getValue()], { type: 'text/plain' });
        
        // Create a download link
        const downloadLink = document.createElement('a');
        downloadLink.href = URL.createObjectURL(blob);
        downloadLink.download = tab.title || 'untitled.txt';
        
        // Trigger the download
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        
        // Update tab information
        tab.content = this.editor.getValue();
        tab.isModified = false;
        this.renderTabs();
    }

    async copyToClipboard() {
        const content = this.editor.getSelection();
        await navigator.clipboard.writeText(content);
    }

    async cutToClipboard() {
        const content = this.editor.getSelection();
        await navigator.clipboard.writeText(content);
        this.editor.replaceSelection('');
    }

    async pasteFromClipboard() {
        const content = await navigator.clipboard.readText();
        this.editor.replaceSelection(content);
    }
}

// At the bottom of script.js
let editor; // Define a global variable for the editor instance

window.addEventListener('load', () => {
    editor = new Editor(); // Assign the instance to the global variable
    window.editor = editor; // Make it accessible through window object
});
