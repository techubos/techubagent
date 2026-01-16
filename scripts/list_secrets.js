
const { execSync } = require('child_process');
try {
    const output = execSync('npx supabase secrets list --project-ref eqoefszhqllengnvjbrm').toString();
    console.log("Full Secrets Output:\n", output);
} catch (e) {
    console.error("Error listing secrets:", e.message);
}
