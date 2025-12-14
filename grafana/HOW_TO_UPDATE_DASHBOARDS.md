# How to Update Grafana Dashboards

## Problem
When using provisioned dashboards in Grafana, changes made in the UI are stored in Grafana's database (which is now persisted in a Docker volume). However, these changes won't be shared via GitHub to other users.

## Solution: Export and Update Dashboard JSON

### Step 1: Make Changes in Grafana UI
1. Open Grafana at http://localhost:3001
2. Login with `admin` / `admin`
3. Make your desired changes to the dashboard
4. Test that everything works

### Step 2: Export Dashboard JSON
1. In Grafana, click on the **Share** icon (or dashboard settings ⚙️)
2. Select **Export** tab
3. Enable **Export for sharing externally**
4. Click **Save to file** or **View JSON**
5. Copy the JSON content

### Step 3: Update Provisioning File
1. Open `grafana/provisioning/dashboards/dashboard.json`
2. Replace the entire content with your exported JSON
3. **Important**: Remove or set `"id": null` in the JSON (line ~21)
4. Save the file

### Step 4: Test the Changes
```bash
# Restart Grafana container
docker compose restart grafana

# Or rebuild if needed
docker compose down grafana
docker compose up -d grafana
```

### Step 5: Verify
1. Open Grafana in a new private/incognito browser window
2. Check if your changes are visible
3. Commit the updated `dashboard.json` to Git

## Alternative: Manual JSON Update

If you only made small changes (like query modifications), you can manually edit the `dashboard.json` file:

1. Find the relevant panel in the JSON (search by panel title)
2. Update the SQL query in the `rawSql` field
3. Save and restart Grafana

## Important Notes

- ✅ The Docker volume `grafana_data` now persists your UI changes locally
- ✅ Other users will get your changes when they pull from GitHub and start containers
- ⚠️ Always export and update the JSON file before committing
- ⚠️ If you modify the JSON file, Grafana will reload it on restart
- 💡 The provisioning config has `allowUiUpdates: true` so you can still make live edits

## Quick Reference

### Files to Update
- `grafana/provisioning/dashboards/dashboard.json` - Main dashboard definition

### Key Settings (dashboard.yml)
- `allowUiUpdates: true` - Allows editing in UI
- `disableDeletion: false` - Allows deletion
- `updateIntervalSeconds: 10` - How often to check for changes

### Common Changes to Export
- New panels
- Modified queries
- Layout changes
- Variable definitions
- Time range settings
- Dashboard settings
