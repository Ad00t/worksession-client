import { MemoryRouter as Router, Switch, Route } from 'react-router-dom';
import './App.css';
import MainView from './views/MainView';

export default function App() {
  return (
    <Router>
      <Switch>
        <Route path="/" component={MainView} />
      </Switch>
    </Router>
  );
}
