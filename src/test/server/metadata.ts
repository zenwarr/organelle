import {should, expect} from 'chai';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import {LibraryDatabase} from "../../server/library-db";
import {TemplateProcessor} from "../../server/formatter";
import {createResourceVarResolver} from "../../server/metadata";
import * as testlib from './testlib';
import {ExistingResource, PersonRelation} from "../../common/db";

should();
chai.use(chaiAsPromised);

describe('metadata', function() {
  describe('resource resolver', function() {
    let lib: LibraryDatabase;
    let proc: TemplateProcessor;

    beforeEach(async function() {
      lib = await testlib.createTestLib();

      proc = new TemplateProcessor(await createResourceVarResolver(lib,
          await lib.getResource(testlib.MIST) as ExistingResource));
    });

    it("should resolve title", async function () {
      return proc.process('{title}').should.eventually.be.equal('The Mist');
    });

    it("should resolve title sort", async function () {
      return proc.process('{title#sort}').should.eventually.be.equal('Mist, The');
    });

    it("should resolve author", async function () {
      return proc.process('{author}').should.eventually.be.equal('Stephen King');
    });

    it("should resolve author sort", async function () {
      return proc.process('{author#sort}').should.eventually.be.equal('King, Stephen');
    });

    it("should resolve author list", async function () {
      await lib.addPersonRelation(testlib.MIST, testlib.PERSON2, PersonRelation.Author);
      expect(await proc.process('{authors}')).to.be.oneOf(
          ['Stephen King, Person 2', 'Person 2, Stephen King']);
    });

    it("should resolve series index", async function () {
      expect(await proc.process('{series#sort} {?series#index|wrap("[@]")}'))
          .to.be.equal('Cool Series, The [1]');
    });

    it("should resolve author sort list", async function () {
      await lib.addPersonRelation(testlib.MIST, testlib.PERSON2, PersonRelation.Author);
      expect(await proc.process('{authors#sort|join(" & ")}')).to.be.oneOf(
          ['King, Stephen & Person 2', 'Person 2 & King, Stephen']);
    });

    it("should resolve rating", async function () {
      await lib.updateResource({
        uuid: testlib.MIST,
        rating: 400
      });
      expect(await proc.process('{rating|format_num("0.00")}')).to.be.equal('4.00');
      expect(await proc.process('{rating}')).to.be.equal('4');
    });
  });
});

