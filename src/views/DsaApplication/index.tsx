import { Route, Switch } from 'react-router-dom';
import DsaApplicationStep1 from './Step1';
import DsaApplicationStep2 from './Step2';

/**
 * Routes for "Dsa Application" flow
 * url: /dsa/application/*
 */
const DsaApplicationRoutes = () => {
  return (
    <Switch>
      <Route path="/dsa/application/1/" component={DsaApplicationStep1} />
      <Route path="/dsa/application/2/" component={DsaApplicationStep2} />
      <Route component={DsaApplicationStep1} />
    </Switch>
  );
};

export default DsaApplicationRoutes;