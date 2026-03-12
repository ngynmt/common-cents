import { describe, it, expect } from "vitest";

// Test the normalizeVote logic (same as in route.ts)
function normalizeVote(voteText: string): string {
  switch (voteText) {
    case "yea":
    case "aye":
      return "yes";
    case "nay":
    case "no":
      return "no";
    case "present":
      return "abstain";
    case "not voting":
      return "not_voting";
    default:
      return "not_voting";
  }
}

describe("normalizeVote", () => {
  it("normalizes yea to yes", () => {
    expect(normalizeVote("yea")).toBe("yes");
  });

  it("normalizes aye to yes", () => {
    expect(normalizeVote("aye")).toBe("yes");
  });

  it("normalizes nay to no", () => {
    expect(normalizeVote("nay")).toBe("no");
  });

  it("normalizes no to no", () => {
    expect(normalizeVote("no")).toBe("no");
  });

  it("normalizes present to abstain", () => {
    expect(normalizeVote("present")).toBe("abstain");
  });

  it("normalizes not voting to not_voting", () => {
    expect(normalizeVote("not voting")).toBe("not_voting");
  });

  it("defaults unknown values to not_voting", () => {
    expect(normalizeVote("xyz")).toBe("not_voting");
  });
});

describe("House XML parsing", () => {
  const sampleHouseXml = `
    <rollcall-vote>
      <vote-data>
        <recorded-vote>
          <legislator name-id="B000574" sort-field="Blumenauer" party="D" state="OR">Mr. Blumenauer</legislator>
          <vote>Aye</vote>
        </recorded-vote>
        <recorded-vote>
          <legislator name-id="S000148" sort-field="Schumer" party="D" state="NY">Mr. Schumer</legislator>
          <vote>Nay</vote>
        </recorded-vote>
        <recorded-vote>
          <legislator name-id="P000197" sort-field="Pelosi" party="D" state="CA">Ms. Pelosi</legislator>
          <vote>Not Voting</vote>
        </recorded-vote>
      </vote-data>
    </rollcall-vote>
  `;

  it("parses votes from House XML", () => {
    const votes = new Map<string, string>();
    const voteRegex = /<legislator\s[^>]*name-id="([^"]+)"[^>]*>[^<]*<\/legislator>\s*<vote>([^<]+)<\/vote>/g;
    let match;
    while ((match = voteRegex.exec(sampleHouseXml)) !== null) {
      const bioguideId = match[1].toLowerCase();
      const voteText = match[2].trim().toLowerCase();
      votes.set(bioguideId, normalizeVote(voteText));
    }

    expect(votes.size).toBe(3);
    expect(votes.get("b000574")).toBe("yes");
    expect(votes.get("s000148")).toBe("no");
    expect(votes.get("p000197")).toBe("not_voting");
  });
});

describe("Senate XML parsing", () => {
  // Real Senate XML has vote_cast BEFORE lis_member_id
  const sampleSenateXml = `
    <roll_call_vote>
      <members>
        <member>
          <member_full>Schumer (D-NY)</member_full>
          <last_name>Schumer</last_name>
          <first_name>Charles</first_name>
          <party>D</party>
          <state>NY</state>
          <vote_cast>Yea</vote_cast>
          <lis_member_id>S270</lis_member_id>
        </member>
        <member>
          <member_full>Cruz (R-TX)</member_full>
          <last_name>Cruz</last_name>
          <first_name>Ted</first_name>
          <party>R</party>
          <state>TX</state>
          <vote_cast>Nay</vote_cast>
          <lis_member_id>S355</lis_member_id>
        </member>
        <member>
          <member_full>Feinstein (D-CA)</member_full>
          <last_name>Feinstein</last_name>
          <first_name>Dianne</first_name>
          <party>D</party>
          <state>CA</state>
          <vote_cast>Not Voting</vote_cast>
          <lis_member_id>S221</lis_member_id>
        </member>
      </members>
    </roll_call_vote>
  `;

  it("parses votes from Senate XML", () => {
    const votes = new Map<string, string>();
    const memberRegex = /<vote_cast>([^<]+)<\/vote_cast>[\s\S]*?<lis_member_id>([^<]+)<\/lis_member_id>/g;
    let match;
    while ((match = memberRegex.exec(sampleSenateXml)) !== null) {
      const voteText = match[1].trim().toLowerCase();
      const lisId = match[2].trim();
      votes.set(lisId, normalizeVote(voteText));
    }

    expect(votes.size).toBe(3);
    expect(votes.get("S270")).toBe("yes");
    expect(votes.get("S355")).toBe("no");
    expect(votes.get("S221")).toBe("not_voting");
  });
});
