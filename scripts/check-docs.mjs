async function run() {
  const res = await fetch("http://localhost:3000/api/documents");
  const data = await res.json();
  console.log("Response:", JSON.stringify(data, null, 2));
}

run().catch(console.error);
