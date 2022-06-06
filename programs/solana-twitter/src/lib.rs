use anchor_lang::prelude::*;
use anchor_lang::solana_program::system_program;

declare_id!("DztaazG8QVrABwRoC4kgCJfaPZmmCu711Ms3uCuaKNcR");

#[program]
pub mod solana_twitter {
    use super::*;

    // A working instruction that initialises a new Tweet account for us and hydrates it with the right information
    pub fn send_tweet(ctx: Context<SendTweet>, topic: String, content: String) -> Result<()> {
        let tweet: &mut Account<Tweet> = &mut ctx.accounts.tweet;
        let author: &Signer = &ctx.accounts.author;
        /**
         * We need access to Solana's Clock system variable to figure out the current
         * timestamp and store it on the tweet.
         */
        let clock: Clock = Clock::get().unwrap();

        if topic.chars().count() > 50 {
            return Err(ErrorCode::TopicTooLong.into());
        }

        if content.chars().count() > 280 {
            return Err(ErrorCode::ContentTooLong.into());
        }
        msg!("HELLOW SOLANA");
        //Let's start with the author's public key. We can access it via author.key
        tweet.author = *author.key;
        // Then, we can retrieve the current UNIX timestamp from the clock by using clock.unix_timestamp.
        tweet.timestamp = clock.unix_timestamp;
        tweet.topic = topic;
        tweet.content = content;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}

#[account]
pub struct Tweet {
    pub author: Pubkey, // pub struct Pubkey(pub(crate) PUBLIC_KEY_LENGTH
    pub timestamp: i64,
    pub topic: String,
    pub content: String,
}

/***
 * adding an account on a context simply means its public key should be
 * provided (see Tweet above) when sending the instruction Additionally, we might also require
 *  the account to use its private key to sign the instruction depending on
 *  what we're planning to do with the account. For instance, we will want
 * the author account to sign the instruction to ensure somebody is not
 * tweeting on behalf of someone else.
 */
#[derive(Accounts)]
pub struct SendTweet<'info> {
    // Account<'info, Tweet> means this is an account of type Tweet and the data should be parsed accordingly.
    #[account(init, payer = author, space = Tweet::LEN)]
    pub tweet: Account<'info, Tweet>,
    //As mentioned above, we need to know who is sending the tweet and we need their signature to prove it.
    /**
     *  the author should pay for the rent-exempt money of the tweet account, we need to mark the author
     * property as mutable. That's because we are going to mutate the amount of money in their account.
     */
    #[account(mut)]
    pub author: Signer<'info>,
    /**
     * we need a constraint on the system_program to ensure it really is the official System Program from Solana.
     * Otherwise, nothing stops users from providing us with a malicious System Program.
     */
    #[account(address = system_program::ID)]
    // pub system_program: AccountInfo<'info>,
    // EDIT 2022-03-22: In newer versions of Anchor, we can achieve the same result by using yet another type of account called Program and passing it the System type to ensure it is the official System program.
    pub system_program: Program<'info, System>,
}

// sizing from https://lorisleiva.com/create-a-solana-dapp-from-scratch/structuring-our-tweet-account
const DISCRIMINATOR_LENGTH: usize = 8;
const PUBLIC_KEY_LENGTH: usize = 32; // 8bits = 1 byte | 1byte * 32 items = 32
const TIME_STAMP: usize = 8;
const STRING_LENGTH_PREFIX: usize = 4;
const MAX_TOPIC_LENGTH: usize = 50 * 4;
const MAX_CONTENT_LENGTH: usize = 280 * 4;

impl Tweet {
    const LEN: usize = DISCRIMINATOR_LENGTH
        + PUBLIC_KEY_LENGTH
        + TIME_STAMP
        + STRING_LENGTH_PREFIX
        + MAX_TOPIC_LENGTH
        + MAX_CONTENT_LENGTH;
}

#[error_code]
pub enum ErrorCode {
    #[msg("The provided topic should be 50 characters long maximum")]
    TopicTooLong,
    #[msg("The provided content should be 280 characters long maximum")]
    ContentTooLong,
}
