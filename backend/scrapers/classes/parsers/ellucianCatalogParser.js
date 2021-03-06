/*
 * Copyright (c) 2017 Ryan Hughes
 *
 * This file is part of CoursePro.
 *
 * CoursePro is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License
 * version 3 as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */

import domutils from 'domutils';
import _ from 'lodash';
import cheerio from 'cheerio';

import cache from '../../cache';
import macros from '../../../macros';
import Request from '../../request';
import EllucianBaseParser from './ellucianBaseParser';
import ellucianClassParser from './ellucianClassParser';
import ellucianRequisitesParser from './ellucianRequisitesParser';
import ellucianRequisitesParser2 from './ellucianRequisitesParser2';


const request = new Request('EllucianCatalogParser');

class EllucianCatalogParser extends EllucianBaseParser.EllucianBaseParser {


  supportsPage(url) {
    return url.indexOf('bwckctlg.p_disp_course_detail') > -1;
  }


  parseClass(element, url) {
    const { termId, classId, subject } = this.parseCatalogUrl(url);

    const depData = {
      desc: '',
      classId: classId,
    };


    depData.prettyUrl = url;

    //get the class name
    const value = domutils.getText(element);

    const match = value.match(/.+?\s-\s*(.+)/i);
    if (!match || match.length < 2 || match[1].length < 2) {
      macros.error('could not find title!', match, value, url);
      return null;
    }
    depData.name = this.standardizeClassName(match[1]);


    //find the box below this row
    let descTR = element.parent.next;
    while (descTR.type !== 'tag') {
      descTR = descTR.next;
    }
    const rows = domutils.getElementsByTagName('td', descTR);
    if (rows.length !== 1) {
      macros.error('td rows !=1??', depData.classId, url);
      return null;
    }

    element = rows[0];


    //get credits from element.parent.text here

    //grab credits
    const text = domutils.getText(element.parent);
    const creditsParsed = this.parseCredits(text);

    if (creditsParsed) {
      depData.maxCredits = creditsParsed.maxCredits;
      depData.minCredits = creditsParsed.minCredits;
    } else {
      macros.log('warning, nothing matchied credits', url, text);
    }


    //desc
    //list all texts between this and next element, not including <br> or <i>
    //usally stop at <span> or <p>
    for (let i = 0; i < element.children.length; i++) {
      if (element.children[i].type === 'tag' && !['i', 'br', 'a'].includes(element.children[i].name)) {
        break;
      }
      depData.desc += `  ${domutils.getText(element.children[i]).trim()}`;
    }

    depData.desc = depData.desc.replace(/\n|\r/gi, ' ').trim();

    //remove credit hours
    // 0.000 TO 1.000 Credit hours
    depData.desc = depData.desc.replace(/(\d+(\.\d+)?\s+TO\s+)?\d+(.\d+)?\s+credit hours/gi, '').trim();

    depData.desc = depData.desc.replace(/\s+/gi, ' ').trim();

    const invalidDescriptions = ['xml extract', 'new search'];

    if (invalidDescriptions.includes(depData.desc.trim().toLowerCase())) {
      return null;
    }


    //url
    depData.url = this.createClassURL(url, termId, subject, classId);
    if (!depData.url) {
      macros.log('error could not create class url', depData);
      return null;
    }

    //find co and pre reqs and restrictions
    const prereqs = ellucianRequisitesParser.parseRequirementSection(url, element.children, 'prerequisites');
    if (prereqs) {
      depData.prereqs = prereqs;
    }

    const coreqs = ellucianRequisitesParser.parseRequirementSection(url, element.children, 'corequisites');
    if (coreqs) {
      depData.coreqs = coreqs;
    }

    //find co and pre reqs and restrictions
    const prereqs2 = ellucianRequisitesParser2.parseRequirementSection(url, element.children, 'prerequisites');
    if (!_.isEqual(prereqs, prereqs2)) {
      macros.log('WARNING: prereqs parsed by the new parser are not equal', JSON.stringify(prereqs, null, 4), JSON.stringify(prereqs2, null, 4));
    }

    const coreqs2 = ellucianRequisitesParser2.parseRequirementSection(url, element.children, 'corequisites');
    if (!_.isEqual(coreqs, coreqs2)) {
      macros.log('WARNING: coreqs parsed by the new parser are not equal', JSON.stringify(coreqs, null, 4), JSON.stringify(coreqs2, null, 4));
    }

    return depData;
  }


  parse(body, url) {
    // Parse the dom
    const $ = cheerio.load(body);

    const elements = $('td.nttitle');

    let matchingElement;

    for (let i = 0; i < elements.length; i++) {
      const currElement = elements[i];

      if (matchingElement) {
        macros.error('Already have a matching element', elements, elements.length);
      }

      if (currElement.parent.parent.attribs.summary.includes('term')) {
        matchingElement = currElement;
      }
    }


    return this.parseClass(matchingElement, url);
  }


  //
  async main(url) {
    // Possibly load from DEV
    if (macros.DEV && require.main !== module) {
      const devData = await cache.get('dev_data', this.constructor.name, url);
      if (devData) {
        return devData;
      }
    }

    const resp = await request.get(url);

    // This is the raw JSON data from the catalog page. No wrapper object with type and value.
    const catalogData = this.parse(resp.body, url);

    // This is a list of class wrapper objects that have deps of sections
    const classListData = await ellucianClassParser.main(catalogData.url, catalogData.name);


    // from the class parser:
    // { name: 'Advanced Writing in the Technical Professions',
    //  url: 'https://wl11gp.neu.edu/udcprod8/bwckctlg.p_disp_listcrse?term_in=201810&subj_in=ENGW&crse_in=3302&schd_in=LEC',
    //  crns: [Object],
    //  honors: false,
    //  prereqs: [Object],
    //  maxCredits: 4,
    //  minCredits: 4 },


    // from the catalog parser:
    //  "desc": "This course introduces students to the procedu [...] once. 5.000 Lecture hours",
    //  "classId": "6100",
    //  "prettyUrl": "https://wl11gp.neu.edu/udcprod8/bwckctlg.p_disp_course_detail?cat_term_in=201812&subj_code_in=LAW&crse_numb_in=6100",
    //  "name": "Civil Procedure",
    //  "maxCredits": 5,
    //  "minCredits": 5,
    //  "url": "https:

    // Merge the data about the class from the catalog page with the data about the class from the class page.
    for (const classWrapper of classListData) {
      // Merge min credits and max credits.
      if (classWrapper.value.maxCredits && classWrapper.value.maxCredits < catalogData.maxCredits) {
        classWrapper.value.maxCredits = catalogData.maxCredits;
      }

      if (classWrapper.value.minCredits && classWrapper.value.minCredits > catalogData.minCredits) {
        classWrapper.value.minCredits = catalogData.minCredits;
      }

      // Add desc, classId, and prettyUrl. This will not exist on the class data yet so no need to check to see if it exists.
      classWrapper.value.desc = catalogData.desc;
      classWrapper.value.classId = catalogData.classId;
      classWrapper.value.prettyUrl = catalogData.prettyUrl;


      if (catalogData.prereqs) {
        // If they both exists and are different I don't really have a great idea of what to do haha
        // Hopefully this _.isEquals dosen't take too long.

        if (classWrapper.value.prereqs && !_.isEqual(classWrapper.value.prereqs, catalogData.prereqs)) {
          macros.log('Not overriding class prereqs with catalog prereqs...', catalogData.url);
        } else {
          classWrapper.value.prereqs = catalogData.prereqs;
        }
      }

      // Do the same thing for coreqs
      if (catalogData.coreqs) {
        if (classWrapper.value.coreqs && !_.isEqual(classWrapper.value.coreqs, catalogData.coreqs)) {
          macros.log('Not overriding class coreqs with catalog coreqs...', catalogData.url);
        } else {
          classWrapper.value.coreqs = catalogData.coreqs;
        }
      }
    }


    // need to merge classListData and catalogData here aka add catalogData to all the classListDatas and check for conflicts


    // Possibly save to dev
    if (macros.DEV && require.main !== module) {
      await cache.set('dev_data', this.constructor.name, url, classListData);

      // Don't log anything because there would just be too much logging.
    }

    return classListData;
  }

  async test() {
    // const output = await module.exports.main('https://wl11gp.neu.edu/udcprod8/bwckctlg.p_disp_course_detail?cat_term_in=201810&subj_code_in=FINA&crse_numb_in=6283');
    const output = await this.main('https://wl11gp.neu.edu/udcprod8/bwckctlg.p_disp_course_detail?cat_term_in=201810&subj_code_in=ENGW&crse_numb_in=3302');
    console.log(JSON.stringify(output[0].deps))
  }


}


EllucianCatalogParser.prototype.EllucianCatalogParser = EllucianCatalogParser;
const instance = new EllucianCatalogParser();

if (require.main === module) {
  instance.test();
}

export default instance;
