# CI/CD Pipeline Documentation

This document describes the continuous integration and deployment pipelines for the UI Testing Framework.

## Pipeline Configurations

### GitHub Actions ([.github/workflows/ci.yml](.github/workflows/ci.yml))

**Triggers:**
- Push to `main` or `dev` branches
- Pull requests to `main` or `dev` branches

**Test Matrix:**
- **Operating Systems**: Ubuntu, Windows, macOS
- **Node.js Versions**: 18.x, 20.x, 22.x

**Pipeline Steps:**

1. **Checkout Code**
   - Uses `actions/checkout@v4`

2. **Setup Node.js**
   - Uses `actions/setup-node@v4`
   - Caches npm dependencies

3. **Install Dependencies**
   - Runs `npm ci` for clean install

4. **Install Chrome** (Ubuntu only)
   - Installs Google Chrome stable from official repository

5. **Run Unit Tests**
   - Executes `npm test`

6. **Run Integration Tests**
   - Executes all test files:
     - `test-dom.js`
     - `test-context.js`
     - `test-wait.js`
     - `test-assertion.js`
     - `test-runner.js`
     - `test-report.js`

7. **Publish to npm** (main branch only)
   - Automatic publish on successful test
   - Requires `NPM_TOKEN` secret

### GitLab CI ([.gitlab-ci.yml](.gitlab-ci.yml))

**Stages:**
1. `test` - Run tests across multiple Node.js versions
2. `deploy` - Publish to npm registry

**Test Jobs:**
- `test:node-18` - Tests on Node.js 18
- `test:node-20` - Tests on Node.js 20
- `test:node-22` - Tests on Node.js 22
- `lint` - Code quality checks (allow failure)

**Deploy Job:**
- `publish:npm` - Manual publish to npm registry
  - Only runs on `main` branch
  - Requires manual trigger
  - Uses `NPM_TOKEN` variable

**Each Test Job:**
1. Installs Chrome stable on Linux
2. Runs `npm test`
3. Runs all integration tests

## Environment Variables

### Required Secrets

**GitHub Actions:**
- `NPM_TOKEN` - npm authentication token for publishing

**GitLab CI:**
- `NPM_TOKEN` - npm authentication token for publishing

### Optional Environment Variables

**Test Configuration:**
- `CHROME_PATH` - Override default Chrome executable path
- `HEADLESS` - Run browser in headless mode (default: true in CI)
- `CI` - Set to 'true' to indicate CI environment

## Test Configuration

The framework uses [test-config.js](test-config.js) to centralize test configuration:

```javascript
import { getChromePath, HEADLESS } from './test-config.js';

await browserConcept.actions.launch({
  executablePath: getChromePath(),
  headless: HEADLESS
});
```

**Platform-specific Chrome paths:**
- **Windows**: `C:\Program Files\Google\Chrome\Application\chrome.exe`
- **macOS**: `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`
- **Linux**: `/usr/bin/google-chrome-stable`

## Running Tests Locally

### Prerequisites
- Node.js 18.0.0 or higher
- Chrome/Chromium browser installed

### Commands

```bash
# Install dependencies
npm ci

# Run unit tests
npm test

# Run integration tests
node test-dom.js
node test-context.js
node test-wait.js
node test-assertion.js
node test-runner.js
node test-report.js

# Run all tests
npm test && \
  node test-dom.js && \
  node test-context.js && \
  node test-wait.js && \
  node test-assertion.js && \
  node test-runner.js && \
  node test-report.js
```

### Custom Chrome Path

```bash
# Windows
set CHROME_PATH=C:\path\to\chrome.exe

# Linux/macOS
export CHROME_PATH=/path/to/chrome

# Run tests
node test-dom.js
```

### Headless Mode

```bash
# Force headless mode
export HEADLESS=true
node test-dom.js

# Force headed mode
export HEADLESS=false
node test-dom.js
```

## Deployment

### GitHub Actions Automatic Deployment

Automatic deployment to npm occurs when:
1. Push to `main` branch
2. All tests pass on all platforms
3. `NPM_TOKEN` secret is configured

### GitLab Manual Deployment

Manual deployment to npm:
1. Navigate to CI/CD → Pipelines
2. Find the pipeline for `main` branch
3. Click the play button on `publish:npm` job
4. Confirm deployment

### Local Deployment

```bash
# Ensure you're on main branch
git checkout main

# Ensure all tests pass
npm test

# Login to npm (if not already)
npm login

# Publish
npm publish --access public
```

## Troubleshooting

### Chrome Installation Issues

**Ubuntu/Debian:**
```bash
wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | sudo apt-key add -
sudo sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list'
sudo apt-get update
sudo apt-get install -y google-chrome-stable
```

**macOS:**
```bash
brew install --cask google-chrome
```

**Windows:**
Download from https://www.google.com/chrome/

### Test Failures in CI

1. **Check Chrome installation**: Ensure Chrome is properly installed
2. **Check Node.js version**: Verify Node.js >= 18.0.0
3. **Check environment variables**: Verify CHROME_PATH if custom
4. **Check headless mode**: Ensure HEADLESS=true in CI
5. **Review logs**: Check full test output in CI logs

### Publishing Failures

1. **Verify npm token**: Ensure NPM_TOKEN is set correctly
2. **Check version**: Ensure package version is incremented
3. **Check permissions**: Verify publish access to package
4. **Test locally**: Run `npm publish --dry-run` first

## Monitoring

### GitHub Actions
- View workflow runs: Repository → Actions
- Check test results in workflow summary
- Download test artifacts if configured

### GitLab CI
- View pipelines: Project → CI/CD → Pipelines
- Check job logs for detailed output
- View test reports in pipeline overview

## Best Practices

1. **Always run tests locally** before pushing
2. **Keep dependencies updated** regularly
3. **Monitor CI logs** for warnings
4. **Use semantic versioning** for releases
5. **Test on multiple platforms** when possible
6. **Keep CI configuration simple** and maintainable
7. **Use caching** to speed up builds
8. **Set appropriate timeouts** for long-running tests

## Future Improvements

- [ ] Add code coverage reporting
- [ ] Add ESLint/Prettier checks
- [ ] Add performance benchmarking
- [ ] Add Docker-based testing
- [ ] Add automated changelog generation
- [ ] Add release notes automation
- [ ] Add security scanning
- [ ] Add dependency vulnerability checks
