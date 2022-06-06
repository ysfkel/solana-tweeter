import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { SolanaTwitter } from "../target/types/solana_twitter";
import * as assert from "assert";
import * as bs58 from "bs58";

describe("solana-twitter", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  // creates a program object we can use in our tests 
  const program = anchor.workspace.SolanaTwitter as Program<SolanaTwitter>;

  it("can send a tweet!", async () => {
    const tweet = anchor.web3.Keypair.generate();

    await program.methods.sendTweet('non_vegetarian', 'I eat meat')
     .accounts({
      tweet: tweet.publicKey,
      author: program.provider.wallet.payer.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId
     })
     .signers([tweet])
     .rpc();
     // Fetch the account details of the created tweet.
     const tweetAccount = await program.account.tweet.fetch(tweet.publicKey)
     console.log(tweetAccount)
     assert.equal(tweetAccount.author.toBase58(), program.provider.wallet.publicKey.toBase58());
     assert.equal(tweetAccount.content, 'I eat meat');
     assert.equal(tweetAccount.topic, 'non_vegetarian');
     assert.ok(tweetAccount.timestamp)
  });

  it('can send tweet without topic', async() => {
    const tweet = anchor.web3.Keypair.generate();
    await program.methods.sendTweet('', 'I eat meat')
    .accounts({
      tweet: tweet.publicKey,
      author: program.provider.wallet.payer.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId
    })
    .signers([tweet])
    .rpc()
    // Fetch the account details of the created tweet.
    const tweetAccount = await program.account.tweet.fetch(tweet.publicKey)
    console.log(tweetAccount)
    assert.equal(tweetAccount.author.toBase58(), program.provider.wallet.publicKey.toBase58());
    assert.equal(tweetAccount.content, 'I eat meat');
    assert.equal(tweetAccount.topic, '');
    assert.ok(tweetAccount.timestamp)
  })

  it('can send a new tweet from a different author', async() => {

    const otherUser = anchor.web3.Keypair.generate();

    const tweet = anchor.web3.Keypair.generate();
    
    // we need to airdrop some money to the otherUser
    const signature =  await program.provider.connection.requestAirdrop(otherUser.publicKey, 1000000000)
    // it's only "requesting" for the airdrop To ensure we wait long enough for the money 
    // to be in the otherUser account, we need to wait for the transaction to confirm.
    await program.provider.connection.confirmTransaction(signature);
    await program.methods.sendTweet('', 'I eat meat')
    .accounts({
      tweet: tweet.publicKey,
      author: otherUser.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId
    })
    .signers([otherUser, tweet])
    .rpc()
    // Fetch the account details of the created tweet.
    const tweetAccount = await program.account.tweet.fetch(tweet.publicKey)
    assert.equal(tweetAccount.author.toBase58(), otherUser.publicKey.toBase58());
    assert.equal(tweetAccount.content, 'I eat meat');
    assert.equal(tweetAccount.topic, '');
    assert.ok(tweetAccount.timestamp)
  })

  it('cannot provide a topic with more than 50 characters', async() => {
    const tweet = anchor.web3.Keypair.generate();

    const topicWith51Chars = 'x'.repeat(51);

    await program.methods.sendTweet(topicWith51Chars, 'I eat meat')
    .accounts({
      tweet: tweet.publicKey,
      author: program.provider.wallet.payer.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId
    })
    .signers([tweet])
    .rpc()
    .catch(error => {
      console.log(error.error)
        assert.equal(error.error.errorMessage, 'The provided topic should be 50 characters long maximum')
        return
    })
  })

  it('cannot provide a content with more than 280 characters', async() => {
    const tweet = anchor.web3.Keypair.generate();

    const contentWith281Chars = 'x'.repeat(281);

    await program.methods.sendTweet('hello', contentWith281Chars)
    .accounts({
      tweet: tweet.publicKey,
      author: program.provider.wallet.payer.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId
    })
    .signers([tweet])
    .rpc()
    .catch(error => {
      console.log(error.error)
        assert.equal(error.error.errorMessage, 'The provided content should be 280 characters long maximum')
        return
    })
  })

  it('can fetch all tweets', async () => {
    const tweetAccounts = await program.account.tweet.all();
    assert.equal(tweetAccounts.length, 3);
    });
   
    it('can filter tweets by author', async () => {

      /**
       * The memcmp filter— is a bit more useful. It allows us to compare an array of bytes with the account's data at a particular offset.
       * That means, we need to provide an array of bytes that should be present in the account's data at a certain position and it will only return these accounts.So we need to provide 2 things:
       * The offset: The position (in bytes) in which we should start comparing the data. This expects an integer.
       * The bytes array: The data to compare to the account's data. This array of bytes should be encoded in base 58.
       * For instance, say I wanted to retrieve all accounts that have my public key at the 42nd byte. Then, I could use the following memcmp filter

       * So we need two things: the offset and the bytes. For the offset,
       *  we need to find out where in the data the author's public key 
       * is stored. Fortunately, we've already done all that work in episode 3. 
       * We know that the first 8 bytes are reserved for the discriminator and 
       * that the author's public key comes afterwards. Therefore, our offset is simply: 8
       */
      const authorPublicKey = program.provider.wallet.publicKey
      const tweetAccounts = await program.account.tweet.all([
          {
              memcmp: {
                  offset: 8, // Discriminator.
                  bytes: authorPublicKey.toBase58(),
              }
          }
      ]);
  
      // the account was used to send 2 tweets above
      assert.equal(tweetAccounts.length, 2);
      /**
       * Let's be a bit more strict in that test and make sure that both of the accounts inside tweetAccounts are in fact from our wallet.
       */
       assert.ok(tweetAccounts.every(tweetAccount => {
        return tweetAccount.account.author.toBase58() === authorPublicKey.toBase58()
       }))

  });

  it('can filter tweets by topics', async () => {
      /**
       * Next, we need to provide a topic to search for in our tests. Since two of the three accounts created in the tests use the veganism topic, let's use that.
       * However, we can't just give 'veganism' as a string to the bytes property. It needs to be a base-58 encoded array of bytes. To do this, we first need to convert our string to a buffer which we can then encode in base 58.
       * We can convert a string to a buffer using Buffer.from('some string').
       * We can base-58 encode a buffer using bs58.encode(buffer).
       * The Buffer variable is already available globally but that's not the case for the bs58 variable that we need to import explicitly at the top of our test file.
       */
       const tweetAccounts = await program.account.tweet.all([
        {
            memcmp: {
                offset: 8 + // Discriminator.
                    32 + // Author public key.
                    8 + // Timestamp.
                    4, // Topic string prefix.
                  bytes: bs58.encode(Buffer.from('non_vegetarian')),
              }
          }
      ]);

      assert.equal(tweetAccounts.length, 2);
      assert.ok(tweetAccounts.every(tweetAccount => {
          return tweetAccount.account.topic === 'non_vegetarian'
      }))
        
  })

});
