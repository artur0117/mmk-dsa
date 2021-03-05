import { SyntheticEvent, useCallback, useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import {
  Grid,
  TextField,
  Card,
  CardHeader,
  CardContent,
  MenuItem,
  Divider,
  Typography,
  LinearProgress,
} from '@material-ui/core';
import api from '../../api';
import { useAppStore } from '../../store';
import { useAppForm, SHARED_CONTROL_PROPS, VALIDATION_PHONE } from '../../utils/form';
import { AppButton, AppAlert } from '../../components';
import { useFormStyles } from '../styles';

const DSA_PROGRESS = 1;

const VALIDATE_FORM = {
  entity_type: {
    type: 'string', // TODO: Change to enum
  },
  first_name: {
    type: 'string',
    presence: { allowEmpty: false },
  },
  last_name: {
    type: 'string',
    presence: { allowEmpty: false },
  },
  secondary_phone: VALIDATION_PHONE,
};

const VALIDATE_EXTENSION = {
  entity_name: {
    type: 'string',
    presence: { allowEmpty: false },
  },
  designation: {
    type: 'string',
    presence: { allowEmpty: false },
  },
};

interface FormStateValues {
  entity_type: string;
  entity_name: string;
  first_name: string;
  last_name: string;
  designation: string;
  secondary_phone: string;
}

/**
 * Renders "Step 1" view for "DSA Application" flow
 * url: /dsa/1
 */
const DsaStep1View = () => {
  const history = useHistory();
  const classes = useFormStyles();
  const [state] = useAppStore();
  const [validationSchema, setValidationSchema] = useState<any>({
    ...VALIDATE_FORM,
    // ...VALIDATE_EXTENSION,
  });
  const [formState, setFormState, onFieldChange, fieldGetError, fieldHasError] = useAppForm({
    validationSchema: validationSchema, // the state value, so could be changed in time
    initialValues: {
      entity_type: '',
      entity_name: '',
      first_name: '',
      last_name: '',
      designation: '',
      secondary_phone: '',
    } as FormStateValues,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [dsaId, setDsaId] = useState<string>();

  const phone = state.verifiedPhone || state.currentUser?.phone || '';
  const email = state.verifiedEmail || state.currentUser?.email || '';

  useEffect(() => {
    let componentMounted = true; // Set "component is live" flag
    async function fetchData() {
      if (!email) return; // email is not loaded yet, wait for next call. Don't reset .loading flag!

      const apiData = await api.dsa.read('', { filter: { email: email }, single: true });
      if (!componentMounted) return; // Component was unmounted while we are calling the API, do nothing!

      setLoading(false);
      if (!apiData) return; // No data from API, do nothing

      setDsaId(apiData.id);
      setFormState((oldFormState) => ({
        ...oldFormState,
        values: {
          ...oldFormState.values,
          entity_type: apiData?.entity_type || '',
          entity_name: apiData?.entity_name || '',
          first_name:
            (apiData?.entity_type === 'individual'
              ? apiData?.individual_first_name
              : apiData?.entity_primary_contact_first_name) || '',
          last_name:
            (apiData?.entity_type === 'individual'
              ? apiData?.individual_last_name
              : apiData?.entity_primary_contact_last_name) || '',
          designation: apiData?.designation || '',
          secondary_phone: apiData?.mobile_number_secondary || '',
        },
      }));
    }
    fetchData(); // Call API asynchronously

    return () => {
      componentMounted = false; // Remove "component is live" flag
    };
  }, [email, setFormState]); // Note: Don't put formState as dependency here !!!

  useEffect(() => {
    let newSchema;
    if ((formState.values as FormStateValues).entity_type === 'individual') {
      newSchema = VALIDATE_FORM;
    } else {
      newSchema = { ...VALIDATE_FORM, ...VALIDATE_EXTENSION };
    }
    setValidationSchema(newSchema);
  }, [formState.values]);

  const handleFormSubmit = useCallback(
    async (event: SyntheticEvent) => {
      event.preventDefault();
      // console.log('onSubmit() - formState.values:', formState.values);
      setLoading(true); // Don't allow to change data anymore

      const values = formState.values as FormStateValues;
      const payload: Record<string, any> = {
        mobile_number: phone,
        // Required values
        entity_type: values.entity_type, // For Step 1 and Step 3
        email: email,
        progress: String(DSA_PROGRESS + 1),
      };

      if (values.entity_type === 'individual') {
        payload.individual_first_name = values.first_name;
        payload.individual_last_name = values.last_name;
      } else {
        payload.entity_name = values.entity_name;
        payload.designation = values.designation;
        payload.entity_primary_contact_first_name = values.first_name;
        payload.entity_primary_contact_last_name = values.last_name;
      }

      if (values.secondary_phone) {
        payload.mobile_number_secondary = values.secondary_phone;
      }
      // console.log('payload:', payload)

      let apiResult;
      if (!dsaId) {
        // Create new record
        apiResult = await api.dsa.create(payload);
      } else {
        // Update existing record
        apiResult = await api.dsa.update(dsaId, payload);
      }
      // console.log('apiResult:', apiResult);
      if (!apiResult) {
        setLoading(false);
        setError('Can not update data via API. Verify you connection to the Internet and try agin later.');
        return;
      }

      history.push(`/dsa/${DSA_PROGRESS + 1}`); // Navigate to next Step
    },
    [formState.values, history, dsaId, phone, email]
  );

  const handleCloseError = useCallback(() => setError(undefined), []);

  if (loading) return <LinearProgress />;

  const inputDisabled = loading || Boolean(error);

  return (
    <form onSubmit={handleFormSubmit}>
      <Grid container direction="column" alignItems="center">
        <Grid item className={classes.formBody}>
          <Card>
            <CardHeader title="DSA Application - Step 1" subheader="Business details" />
            <CardContent>
              <TextField
                autoFocus
                required
                disabled={inputDisabled}
                select
                label="Type of Entity"
                name="entity_type"
                value={(formState.values as FormStateValues).entity_type}
                error={fieldHasError('entity_type')}
                helperText={fieldGetError('entity_type') || ' '}
                onChange={onFieldChange}
                {...SHARED_CONTROL_PROPS}
              >
                <MenuItem value="individual">Individual</MenuItem>
                <MenuItem value="company">Company</MenuItem>
                <MenuItem value="partnership">Partnership</MenuItem>
              </TextField>
              {(formState.values as FormStateValues).entity_type !== 'individual' && (
                <>
                  <TextField
                    required
                    disabled={inputDisabled}
                    label={
                      (formState.values as FormStateValues).entity_type === 'partnership'
                        ? 'Partnership Name'
                        : 'Company Name'
                    }
                    name="entity_name"
                    value={(formState.values as FormStateValues).entity_name}
                    error={fieldHasError('entity_name')}
                    helperText={fieldGetError('entity_name') || ' '}
                    onChange={onFieldChange}
                    {...SHARED_CONTROL_PROPS}
                  />
                  <br />
                  <br />
                  <Divider />
                  <br />

                  <Typography variant="h6">Primary Contact</Typography>
                  <br />
                </>
              )}

              <TextField
                required
                disabled={inputDisabled}
                label="First Name"
                name="first_name"
                value={(formState.values as FormStateValues).first_name}
                error={fieldHasError('first_name')}
                helperText={fieldGetError('first_name') || ' '}
                onChange={onFieldChange}
                {...SHARED_CONTROL_PROPS}
              />
              <TextField
                required
                disabled={inputDisabled}
                label="Last Name"
                name="last_name"
                value={(formState.values as FormStateValues).last_name}
                error={fieldHasError('last_name')}
                helperText={fieldGetError('last_name') || ' '}
                onChange={onFieldChange}
                {...SHARED_CONTROL_PROPS}
              />

              {(formState.values as FormStateValues).entity_type !== 'individual' && (
                <TextField
                  required
                  disabled={inputDisabled}
                  label="Designation"
                  name="designation"
                  value={(formState.values as FormStateValues).designation}
                  error={fieldHasError('designation')}
                  helperText={fieldGetError('designation') || ' '}
                  onChange={onFieldChange}
                  {...SHARED_CONTROL_PROPS}
                />
              )}

              <TextField
                disabled
                label={state.verifiedPhone ? 'Verified Email' : 'Email'}
                name="email"
                value={email}
                helperText=" "
                {...SHARED_CONTROL_PROPS}
              />

              <TextField
                disabled
                label={state.verifiedPhone ? 'Verified Phone' : 'Phone'}
                name="phone"
                value={phone}
                helperText=" "
                {...SHARED_CONTROL_PROPS}
              />

              <TextField
                disabled={inputDisabled}
                label="Secondary Phone"
                name="secondary_phone"
                value={(formState.values as FormStateValues).secondary_phone}
                error={fieldHasError('secondary_phone')}
                helperText={fieldGetError('secondary_phone') || ' '}
                onChange={onFieldChange}
                {...SHARED_CONTROL_PROPS}
              />
              <br />
              <br />
              <Divider />
              <br />

              {error ? (
                <AppAlert severity="error" onClose={handleCloseError}>
                  {error}
                </AppAlert>
              ) : null}

              <Grid container justify="center" alignItems="center">
                <AppButton type="submit" disabled={inputDisabled || !formState.isValid}>
                  Confirm and Continue
                </AppButton>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </form>
  );
};

export default DsaStep1View;
