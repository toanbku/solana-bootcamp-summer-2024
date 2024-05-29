import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TodoApp } from "../target/types/todo_app";
import { assert, expect } from "chai";
import { withErrorTest } from "./utils";

describe("todo-app-toggle", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.TodoApp as Program<TodoApp>;
  const name = "Toan Ho";
  const content = "Test todo";

  let profile: anchor.web3.PublicKey,
    profileAccount: Awaited<ReturnType<typeof program.account.profile.fetch>>,
    todo: anchor.web3.PublicKey;

  before(async () => {
    // create profile
    [profile] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("profile"), provider.publicKey.toBytes()],
      program.programId
    );

    const createProfileTx = await program.methods
      .createProfile(name)
      .accounts({
        creator: provider.publicKey,
        profile,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    console.log(">>> createProfileTx:", createProfileTx);

    profileAccount = await program.account.profile.fetch(profile);
    const currentTodoCount = profileAccount.todoCount;

    // create todo
    [todo] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("todo"), profile.toBytes(), Buffer.from([currentTodoCount])],
      program.programId
    );

    const createTodoTx = await program.methods
      .createTodo(content)
      .accounts({
        creator: provider.publicKey,
        profile,
        todo,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    console.log(">>> createTodoTx:", createTodoTx);
  });

  it("Toggle todo successfully", async () => {
    const toggleTx = await program.methods
      .toggleTodo()
      .accounts({
        creator: provider.publicKey,
        profile,
        todo,
      })
      .rpc();

    console.log(">>> toggleTx", toggleTx);
    const todoAccount = await program.account.todo.fetch(todo);
    expect(todoAccount.completed).to.equal(true);

    profileAccount = await program.account.profile.fetch(profile);
  });

  it("Toggle todo failed", async () => {
    const randomKeypair = anchor.web3.Keypair.generate();

    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(
        randomKeypair.publicKey,
        anchor.web3.LAMPORTS_PER_SOL
      ),
      "confirmed"
    );

    withErrorTest(async () => {
      try {
        const toggleTx = await program.methods
          .toggleTodo()
          .accounts({
            creator: randomKeypair.publicKey,
            profile,
            todo,
          })
          .signers([randomKeypair])
          .rpc();

        console.log(">>> toggleTx:", toggleTx);

        assert.ok(false);
      } catch (_err) {
        assert.isTrue(_err instanceof anchor.AnchorError);
        const err: anchor.AnchorError = _err;
        assert.strictEqual(err.error.errorMessage, "Invalid authority");
        assert.strictEqual(
          err.program.toString(),
          program.programId.toString()
        );
      }
    });
  });
});
