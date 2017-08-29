import {should, expect} from 'chai';
import {Library} from "../../server/library";
import {createTestLib} from "./testlib";
import {OBJ1, OBJ3, StorageMock} from "./storage-mock";

should();

describe("Library", function () {
  let lib: Library;

  beforeEach(async function() {
    lib = new Library(await createTestLib());
    lib.addStorage(new StorageMock());
  });

  it("should resolve object locations", async function () {
    let gen = lib.objectLocations(OBJ1);
    expect(await gen.next().value).to.be.equal('organelle://loc1');
    expect(await gen.next().value).to.be.equal('organelle://loc2');
    expect(gen.next().value).to.be.undefined;
  });

  it("should not resolve empty object locations", async function () {
    let gen = lib.objectLocations(OBJ3);
    expect(await gen.next().value).to.be.undefined;
  });
});
