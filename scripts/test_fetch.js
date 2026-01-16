
const URL = "https://mmg.whatsapp.net/o1/v/t24/f2/m239/AQNnjKOqpkg2sL9F5qPXUXN8RZZ-jK3aD2LGp7TR9i49iJ7eoGT_Xf1d8OjA-P4La-4QnLjFGr93ICqqYvnboB1_bWZbpI49BILnXxZT9w?ccb=9-4&oh=01_Q5Aa3gFHb3d0gWMzJBgwoacYc7hiQYrQ3aHSCUffSyuXSRbe3Q&oe=698D0B81&_nc_sid=e6ed6c&mms3=true";

async function testFetch() {
    console.log(`\n--- Testing MMS URL Fetch ---`);
    try {
        const res = await fetch(URL);
        console.log("Status:", res.status);
        console.log("Headers:", JSON.stringify([...res.headers], null, 2));
        const blob = await res.blob();
        console.log("Blob Size:", blob.size);
    } catch (e) {
        console.error("Fetch failed:", e.message);
    }
}

testFetch();
