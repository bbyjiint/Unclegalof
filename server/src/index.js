import "dotenv/config";
import { createApp } from "./app.js";

const port = Number(process.env.PORT || 4001);
const app = createApp();

app.listen(port, () => {
  console.log(`API server listening on http://localhost:${port}`);
});
