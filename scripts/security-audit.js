
import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import dotenv from 'dotenv';
import path from 'path';

// 1. CONFIG
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
// Use explicit Service Key for setup/admin tasks
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxb2Vmc3pocWxsZW5nbnZqYnJtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Nzg5NjEzMiwiZXhwIjoyMDgzNDcyMTMyfQ.z03uiVa5HSL9XcTBYSBzoLGDyomduf_uHtS98HF6nno";

if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error(chalk.red('FATAL: Missing URL or SERVICE_KEY.'));
    process.exit(1);
}

// 2. CLIENTS
const adminClient = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
});

// We will create limited clients later
let clientA, clientB, clientAnon;

// 3. STATE
let orgA_id, orgB_id;
let userA_id, userB_id;
let stats = { total: 0, passed: 0, failed: 0 };

async function runAudit() {
    console.clear();
    console.log(chalk.bold.blue('=========================================='));
    console.log(chalk.bold.blue('   TECHUB AGENT - RLS SECURITY AUDIT      '));
    console.log(chalk.bold.blue('=========================================='));
    console.log(chalk.gray(`Target: ${SUPABASE_URL}`));

    try {
        // === SETUP ===
        console.log(chalk.yellow('\n1. Setting up Test Environment...'));

        // Create Orgs
        const { data: orgA, error: errA } = await adminClient.from('organizations').insert({
            name: 'AUDIT_ORG_A',
            slug: `audit-org-a-${Date.now()}`
        }).select().single();
        if (errA) throw new Error(`Setup Org A failed: ${errA.message}`);
        orgA_id = orgA.id;

        const { data: orgB, error: errB } = await adminClient.from('organizations').insert({
            name: 'AUDIT_ORG_B',
            slug: `audit-org-b-${Date.now()}`
        }).select().single();
        if (errB) throw new Error(`Setup Org B failed: ${errB.message}`);
        orgB_id = orgB.id;

        console.log(chalk.gray(`   Created Orgs: ${orgA_id} / ${orgB_id}`));

        // Create Users with ID mapping in Metadata (simulating what happens in a real app or custom claim)
        // Note: Our RLS checks `auth.jwt()->>'organization_id'`.
        // We can simulate this by logging in and passing the JWT, OR simpler:
        // Use `adminClient.auth.admin.createUser` with `user_metadata`.
        // BUT `createClient` won't automatically put metadata in JWT top-level unless updated via custom claims hook?
        // Wait, the function `get_user_org_id` checks `app_metadata` AND `user_metadata`. 
        // So putting it in `user_metadata` is enough for our function!

        const emailA = `audit.user.a.${Date.now()}@test.com`;
        const emailB = `audit.user.b.${Date.now()}@test.com`;
        const password = 'audit-password-123';

        const { data: uA, error: ueA } = await adminClient.auth.admin.createUser({
            email: emailA,
            password: password,
            email_confirm: true,
            user_metadata: { organization_id: orgA_id }
        });
        if (ueA) throw new Error(`User A create failed: ${ueA.message}`);
        userA_id = uA.user.id;

        const { data: uB, error: ueB } = await adminClient.auth.admin.createUser({
            email: emailB,
            password: password,
            email_confirm: true,
            user_metadata: { organization_id: orgB_id }
        });
        if (ueB) throw new Error(`User B create failed: ${ueB.message}`);
        userB_id = uB.user.id;

        // Sign In to get Tokens (Use a separate client to avoid polluting adminClient session)
        const authClient = createClient(SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY || 'fake-anon', {
            auth: { persistSession: false }
        });

        const { data: sessionA } = await authClient.auth.signInWithPassword({ email: emailA, password });
        const { data: sessionB } = await authClient.auth.signInWithPassword({ email: emailB, password });

        clientA = createClient(SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY || 'fake-anon', {
            global: { headers: { Authorization: `Bearer ${sessionA.session.access_token}` } }
        });

        clientB = createClient(SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY || 'fake-anon', {
            global: { headers: { Authorization: `Bearer ${sessionB.session.access_token}` } }
        });

        // Also create an Anon client
        clientAnon = createClient(SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY || 'fake-anon');

        // Seed Data (Org A Contacts, Org B Contacts)
        // Seed Data (Org A Contacts, Org B Contacts)
        const phoneA = `111-${Date.now()}`;
        const phoneB = `222-${Date.now()}`;

        const { error: seedErrA } = await adminClient.from('contacts').insert({ organization_id: orgA_id, name: 'Contact A1', phone: phoneA });
        if (seedErrA) throw new Error(`Seed A failed: ${seedErrA.message}`);

        const { error: seedErrB } = await adminClient.from('contacts').insert({ organization_id: orgB_id, name: 'Contact B1', phone: phoneB });
        if (seedErrB) throw new Error(`Seed B failed: ${seedErrB.message}`);

        console.log(chalk.green('   Setup Complete.'));


        // === TESTS ===

        // TEST 1: User A trying to read Org B Contacts
        await runTest('1. Cross-Org Read Check', async () => {
            const { data, error } = await clientA
                .from('contacts')
                .select('*')
                .eq('organization_id', orgB_id); // Specifically asking for neighbor's data

            // Expected: Return empty array. RLS filters it out.
            // ERROR implies permission denied or network fail.
            // DATA implies leakage if length > 0.

            if (error) return { success: false, msg: `Query Error: ${error.message}` };
            if (data.length > 0) return { success: false, msg: `LEAK DETECTED! Found ${data.length} rows from Org B.` };
            return { success: true, msg: 'No data returned from Org B.' };
        });

        // TEST 2: User A trying to Insert into Org B
        await runTest('2. Cross-Org Insert Check', async () => {
            const { data, error } = await clientA
                .from('contacts')
                .insert({
                    organization_id: orgB_id, // Malicious ID
                    name: 'Hacker Contact',
                    phone: '666'
                })
                .select();

            // Expected: Error (RLS Check Violation)
            if (!error) return { success: false, msg: `Insert Succeeded! New ID: ${data?.[0]?.id}` };
            return { success: true, msg: `Blocked correctly: ${error.message}` };
        });

        // TEST 3: User A trying to Update OWN contact to move it to Org B (Side-loaded attack)
        await runTest('3. Cross-Org Update Check', async () => {
            // First get a valid contact of A
            const { data: myContact } = await clientA.from('contacts').select('id').eq('organization_id', orgA_id).limit(1).single();
            if (!myContact) return { success: false, msg: 'Setup Error: No contact found for A' };

            const { error } = await clientA
                .from('contacts')
                .update({ organization_id: orgB_id }) // Trying to move it
                .eq('id', myContact.id);

            // Expected: Error (RLS Check Violation on Update)
            if (!error) return { success: false, msg: 'Update Succeeded! Moved contact to Org B.' };
            return { success: true, msg: `Blocked correctly: ${error.message}` };
        });

        // TEST 4: User A Select ALL (Should verify scoping)
        await runTest('4. Scoped Select *', async () => {
            const { data, error } = await clientA.from('contacts').select('*');

            if (error) return { success: false, msg: error.message };

            const foreignData = data.filter(c => c.organization_id !== orgA_id);
            if (foreignData.length > 0) return { success: false, msg: `Found ${foreignData.length} foreign contacts!` };

            // Should find at least 1 local
            if (data.length === 0) return { success: false, msg: 'Found 0 contacts (Too strict? Or setup fail?)' };

            return { success: true, msg: `Retrieved ${data.length} contacts (All local).` };
        });

        // TEST 5: Service Role Access (Should see everything)
        await runTest('5. Service Role Super-Access', async () => {
            const { data, error } = await adminClient
                .from('contacts')
                .select('*')
                .in('organization_id', [orgA_id, orgB_id]); // Look specifically for our test data
            if (error) return { success: false, msg: error.message };

            // Should verify it sees BOTH orgs
            const orgsFound = new Set(data.map(c => c.organization_id));
            if (orgsFound.size < 2) return { success: false, msg: `Admin only sees ${orgsFound.size} orgs. Expected >= 2.` };

            return { success: true, msg: `Admin sees ${data.length} contacts across ${orgsFound.size} orgs.` };
        });

        // TEST 6: Anon Access (Should see nothing)
        await runTest('6. Anon/Public Access Block', async () => {
            const { data, error } = await clientAnon.from('contacts').select('*');
            // Expected: Empty array OR Error depending on Policy (usually empty if just RLS filters, Error if no SELECT policy for anon)

            // If my SQL removed "Allow All", then Anon probably has NO policy for SELECT.
            // So it should return empty (default deny) OR error.

            if (data && data.length > 0) return { success: false, msg: `Anon saw ${data.length} rows!` };
            return { success: true, msg: 'Anon access denied/empty.' };
        });


    } catch (err) {
        console.error(chalk.red('\nFATAL ERROR EXECUTION:'), err);
        stats.failed++;
    } finally {
        // === CLEANUP ===
        console.log(chalk.yellow('\nCleaning up...'));
        if (orgA_id) await adminClient.from('organizations').delete().eq('id', orgA_id);
        if (orgB_id) await adminClient.from('organizations').delete().eq('id', orgB_id);
        if (userA_id) await adminClient.auth.admin.deleteUser(userA_id);
        if (userB_id) await adminClient.auth.admin.deleteUser(userB_id);
    }

    // SUMMARY
    console.log('\n');
    console.log(chalk.bold.white('-------------------------------------'));
    console.log(chalk.bold.white(`Tests: ${stats.total} | Passed: ${chalk.green(stats.passed)} | Failed: ${chalk.red(stats.failed)}`));
    console.log(chalk.bold.white('-------------------------------------'));

    if (stats.failed > 0) {
        process.exit(1);
    } else {
        process.exit(0);
    }
}

async function runTest(name, fn) {
    stats.total++;
    process.stdout.write(chalk.white(`${name}... `));
    try {
        const result = await fn();
        if (result.success) {
            console.log(chalk.green('✔ PASS') + chalk.gray(` (${result.msg})`));
            stats.passed++;
        } else {
            console.log(chalk.red('✘ FAIL') + chalk.red(` (${result.msg})`));
            stats.failed++;
        }
    } catch (e) {
        console.log(chalk.red('✘ EXCEPTION') + chalk.red(` (${e.message})`));
        stats.failed++;
    }
}

runAudit();
