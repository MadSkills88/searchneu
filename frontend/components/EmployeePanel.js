import React, { PropTypes } from 'react';
import CSSModules from 'react-css-modules';
import classNames from 'classnames/bind';

import css from './EmployeePanel.css';

const cx = classNames.bind(css);


// name, id, phone, email, primaryappointment, primarydepartment, link, positions, office, personalSite, bigPictureLink
class EmployeePanel extends React.Component {

  render() {
    const employee = this.props.employee;

    // Create the address box
    const officeElements = [];
    if (employee.office) {
      const lines = employee.office.split('\r\n');

      lines.forEach((line, index) => {
        officeElements.push(line);
        if (lines.length - 1 !== index) {
          officeElements.push(<br key={ index } />);
        }
      });
    }


    const contactText = [];

    if (employee.positions) {
      employee.positions.forEach((position) => {
        contactText.push(position);
      });
    } else if (employee.primaryappointment) {
      contactText.push(employee.primaryappointment);
    }

    if (employee.primarydepartment) {
      contactText.push(employee.primarydepartment);
    }
    if (employee.email) {
      contactText.push(<a href={ `mailto:${employee.email}` }>{employee.email}</a>);
    }

    if (employee.phone) {
      const phone = [];
      phone.push(employee.phone.slice(0, 3));
      phone.push('-');
      phone.push(employee.phone.slice(3, 6));
      phone.push('-');
      phone.push(employee.phone.slice(6, 11));

      const phoneText = phone.join('');

      contactText.push(<a href={ `tel:${phoneText}` }>{phoneText}</a>);
    }

    const contactElements = [];


    // Add <br/>s between the elements
    for (let i = 0; i < contactText.length; i++) {
      const element = contactText[i];
      contactElements.push(element);
      if (contactText.length - 1 !== i) {
        contactElements.push(<br key={ i } />);
      }
    }


    return (
      <div className={ `${css.container} ui segment` }>
        <div className={ css.header }>
          {employee.name}
        </div>

        <div className={ css.body }>
          <div className={ `${css.inlineBlock} ${css.contactBox}` }>
            {contactElements}
          </div>
          <div className={ css.inlineBlock +' '+ css.addressBox }>
            {officeElements}
          </div>
        </div>
      </div>
    );
  }
}

EmployeePanel.propTypes = {
  employee: PropTypes.object.isRequired,
};


export default CSSModules(EmployeePanel, css);