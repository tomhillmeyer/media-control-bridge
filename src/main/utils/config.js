const fs = require('fs');
const path = require('path');
const os = require('os');

class Config {
  constructor() {
    this.configDir = path.join(os.homedir(), '.media-control-bridge');
    this.configFile = path.join(this.configDir, 'config.json');
    this.defaultConfig = {
      server: {
        httpPort: 6262,
        websocketPort: 6262
      },
      media: {
        allowedApps: ['all'],
        excludedApps: []
      },
      ui: {
        showNotifications: true,
        startMinimized: true
      },
      autoStart: false
    };
    this.config = this.load();
  }

  ensureConfigDir() {
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }
  }

  load() {
    this.ensureConfigDir();

    if (fs.existsSync(this.configFile)) {
      try {
        const data = fs.readFileSync(this.configFile, 'utf8');
        return { ...this.defaultConfig, ...JSON.parse(data) };
      } catch (error) {
        console.error('Error loading config, using defaults:', error);
        return this.defaultConfig;
      }
    }

    // Create default config file
    this.save(this.defaultConfig);
    return this.defaultConfig;
  }

  save(config = this.config) {
    this.ensureConfigDir();
    try {
      fs.writeFileSync(this.configFile, JSON.stringify(config, null, 2));
      this.config = config;
    } catch (error) {
      console.error('Error saving config:', error);
    }
  }

  get(key) {
    const keys = key.split('.');
    let value = this.config;
    for (const k of keys) {
      value = value[k];
      if (value === undefined) return undefined;
    }
    return value;
  }

  set(key, value) {
    const keys = key.split('.');
    let obj = this.config;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!obj[keys[i]]) obj[keys[i]] = {};
      obj = obj[keys[i]];
    }
    obj[keys[keys.length - 1]] = value;
    this.save();
  }
}

module.exports = new Config();
