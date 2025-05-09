import { IdResolver } from "@atproto/identity";
import { Firehose, MemoryRunner } from "@atproto/sync";
import { AtUri } from "@atproto/syntax";
import { createClient } from "@supabase/supabase-js";
import { readFile, writeFile } from "fs/promises";
import {
  PubLeafletDocument,
  PubLeafletPost,
  PubLeafletPublication,
} from "lexicons/api";
import { ids } from "lexicons/api/lexicons";
import { Database, Json } from "supabase/database.types";
const idResolver = new IdResolver();

const cursorFile = "/cursor/cursor.bin";

// let supabase = createClient<Database>(
//   process.env.NEXT_PUBLIC_SUPABASE_API_URL as string,
//   process.env.SUPABASE_SERVICE_ROLE_KEY as string,
// );
async function main() {
  let startCursor;
  try {
    startCursor = parseInt((await readFile(cursorFile)).toString());
  } catch (e) {}
  const runner = new MemoryRunner({
    startCursor,
    setCursor: async (cursor) => {
      await writeFile(cursorFile, cursor.toString());
      // persist cursor
    },
  });
  let firehose = new Firehose({
    excludeAccount: true,
    excludeIdentity: true,
    runner,
    idResolver,
    filterCollections: [
      ids.PubLeafletDocument,
      ids.PubLeafletPublication,
      ids.PubLeafletPost,
    ],
    handleEvent: async (evt) => {
      if (
        evt.event == "account" ||
        evt.event === "identity" ||
        evt.event === "sync"
      )
        return;
      console.log(`${evt.event} in ${evt.collection}`);
      if (evt.collection === ids.PubLeafletDocument) {
        if (evt.event === "create" || evt.event === "update") {
          let record = PubLeafletDocument.validateRecord(evt.record);
          if (!record.success) {
            return;
          }
          console.log("PRETENDING TO UPSERT");
          // await supabase.from("documents").upsert({
          //   uri: evt.uri.toString(),
          //   data: record.value as Json,
          // });
          let publicationURI = new AtUri(record.value.publication);

          if (publicationURI.host !== evt.uri.host) {
            console.log("Unauthorized to create post!");
            return;
          }
          console.log("PRETENDING TO INSERT");
          // await supabase.from("documents_in_publications").insert({
          //   publication: record.value.publication,
          //   document: evt.uri.toString(),
          // });
        }
        if (evt.event === "delete") {
          console.log("PRETENDING TO DELETE");
          // await supabase
          //   .from("documents")
          //   .delete()
          //   .eq("uri", evt.uri.toString());
        }
      }
      if (evt.collection === ids.PubLeafletPublication) {
        if (evt.event === "create" || evt.event === "update") {
          let record = PubLeafletPublication.validateRecord(evt.record);
          if (!record.success) return;
          console.log("PRETENDING TO UPSERT");
          // await supabase.from("publications").upsert({
          //   uri: evt.uri.toString(),
          //   identity_did: evt.did,
          //   name: record.value.name,
          // });
        }
        if (evt.event === "delete") {
          console.log("PRETENDING TO DELETE");
          // await supabase
          //   .from("publications")
          //   .delete()
          //   .eq("uri", evt.uri.toString());
        }
      }
      if (evt.collection === ids.PubLeafletPost) {
        if (evt.event === "create" || evt.event === "update") {
          let record = PubLeafletPost.validateRecord(evt.record);
          if (!record.success) return;
        }
      }
    },
    onError: (err) => {
      console.error(err);
    },
  });
  console.log("starting firehose consumer");
  firehose.start();
  const cleanup = () => {
    console.log("shutting down firehose...");
    firehose.destroy();
    runner.destroy();
    process.exit();
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
}

main();

//Should I make a helper for writing these hmmm... I need to make create / updates for all of these
// Creates should basically be the same as updates right? Ya, as long as you make sure to upsert stuff!
//
