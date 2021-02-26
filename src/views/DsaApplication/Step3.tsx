import { SyntheticEvent, useCallback, useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { Grid, TextField, Card, CardHeader, CardContent, MenuItem, Divider, LinearProgress } from '@material-ui/core';
import api from '../../api';
import { useAppStore } from '../../store';
import { useAppForm, SHARED_CONTROL_PROPS } from '../../utils/form';
import { getAssetUrl } from '../../utils/url';
import { AppButton, AppAlert } from '../../components';
import { useFormStyles } from '../styles';
import { UploadInput } from '../../components/Upload';

const DSA_PROGRESS = 3;

const VALIDATE_FORM = {
  individual_id_proof_type: {
    presence: { allowEmpty: false },
    type: 'string',
  },

  pan_number: {
    presence: { allowEmpty: false },
    type: 'string',
    length: {
      is: 10,
      message: 'must be exactly 10 characters',
    },
  },
};

interface FormStateValues {
  pan_number: string;
  image_pan_card: string;

  individual_id_proof_type: string;
  image_id_document: string;
}

interface FormFiles {
  image_pan_card?: File;
  image_id_document?: File;
}

/**
 * Renders "Step 3" view for "DSA Application" flow
 * url: /dsa/3
 */
const DsaStep3View = () => {
  const history = useHistory();
  const classes = useFormStyles();
  const [state] = useAppStore();
  const [formState, setFormState, onFieldChange, fieldGetError, fieldHasError] = useAppForm({
    validationSchema: VALIDATE_FORM, // must be const outside the component
    initialValues: {
      pan_number: '',
      image_pan_card: '',

      individual_id_proof_type: '',
      image_id_document: '',
    } as FormStateValues,
  });
  const [files, setFiles] = useState<FormFiles>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [dsaId, setDsaId] = useState<string>();

  const email = state.verifiedEmail || state.currentUser?.email || '';

  useEffect(() => {
    let componentMounted = true; // Set "component is live" flag
    async function fetchData() {
      const email = state.verifiedEmail || state.currentUser?.email || '';
      if (!email) return; // email is not loaded yet, wait for next call. Don't reset .loading flag!

      const apiData = await api.dsa.read('', { filter: { email: email }, single: true });
      if (!componentMounted) return; // Component was unmounted while we are calling the API, do nothing!

      if (Number(apiData?.progress) < DSA_PROGRESS) {
        // Force jumping to latest incomplete step
        history.push(`/dsa/${Number(apiData?.progress) || 1}`);
        return;
      }

      setLoading(false);
      if (!apiData) return; // No data from API, do nothing

      setDsaId(apiData.id);
      setFormState((oldFormState) => ({
        ...oldFormState,
        values: {
          ...oldFormState.values,
          pan_number: apiData?.pan_number || '',
          image_pan_card: apiData?.image_pan_card || '',

          individual_id_proof_type: apiData?.individual_id_proof_type || '',
          image_id_document: apiData?.image_id_document || '',
        },
      }));
    }
    fetchData(); // Call API asynchronously

    return () => {
      componentMounted = false; // Remove "component is live" flag
    };
  }, [email, setFormState]); // Note: Don't put formState as dependency here !!!

  function validFiles(): Boolean {
    const required1 = true;
    const required2 = true;
    const file1 = Boolean(!required1 || files?.image_pan_card || (formState.values as FormStateValues).image_pan_card);
    const file2 = Boolean(
      !required2 || files?.image_id_document || (formState.values as FormStateValues).image_id_document
    );
    return file1 && file2;
  }

  const handleFileChange = useCallback(
    (event, name, file) => {
      const newFiles = {
        ...files,
        [name]: file,
      };
      setFiles(newFiles);
    },
    [files]
  );

  const handleFormSubmit = useCallback(
    async (event: SyntheticEvent) => {
      // Submit user entered data to API

      event.preventDefault();
      // console.log('onSubmit() - formState.values:', formState.values);
      setLoading(true); // Don't allow to change data anymore

      // Upload new files
      let image_pan_card = (formState.values as FormStateValues).image_pan_card;
      if (files?.image_pan_card) {
        let apiRes;
        const payload = {
          data: files?.image_pan_card,
        };
        try {
          if (image_pan_card) {
            // Update existing file
            apiRes = await api.file.update(image_pan_card, payload);
          } else {
            // Create new file
            apiRes = await api.file.create(payload);
          }
        } catch (error) {
          // TODO: Halt form submission if needed
          console.log(error);
        }
        image_pan_card = apiRes?.id;
      }

      // Upload new files
      let image_id_document = (formState.values as FormStateValues).image_id_document;
      if (files?.image_id_document) {
        let apiRes;
        const payload = {
          data: files?.image_id_document,
        };
        try {
          if (image_id_document) {
            // Update existing file
            apiRes = await api.file.update(image_id_document, payload);
          } else {
            // Create new file
            apiRes = await api.file.create(payload);
          }
        } catch (error) {
          // TODO: Halt form submission if needed
          console.error(error);
        }
        image_id_document = apiRes?.id;
      }
      // Create/Update DSA Application record
      let apiResult;
      const payload = {
        ...formState.values,
        image_pan_card,
        image_id_document,
        // Required values
        email,
        progress: DSA_PROGRESS + 1,
      };
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
    [formState.values, files, history, dsaId, email, files]
  );

  const handleCloseError = useCallback(() => setError(undefined), []);

  if (loading) return <LinearProgress />;

  const inputDisabled = loading || Boolean(error);

  return (
    <form onSubmit={handleFormSubmit}>
      <Grid container direction="column" alignItems="center">
        <Grid item className={classes.formBody}>
          <Card>
            <CardHeader title="DSA Application - Step 3" subheader="KYC details" />
            <CardContent>
              <TextField
                required
                disabled={inputDisabled}
                label="PAN Number"
                name="pan_number"
                value={(formState.values as FormStateValues).pan_number}
                error={fieldHasError('pan_number')}
                helperText={fieldGetError('pan_number') || ' '}
                onChange={onFieldChange}
                {...SHARED_CONTROL_PROPS}
              />

              <UploadInput
                name="image_pan_card"
                url={getAssetUrl((formState.values as FormStateValues).image_pan_card)}
                buttonTitle="Upload PAN Card Image"
                onFileChange={handleFileChange}
              />

              <br />
              <br />
              <Divider />
              <br />

              <TextField
                required
                disabled={inputDisabled}
                select
                label="ID Proof (please provide any one)"
                name="individual_id_proof_type"
                value={(formState.values as FormStateValues).individual_id_proof_type}
                error={fieldHasError('individual_id_proof_type')}
                helperText={fieldGetError('individual_id_proof_type') || ' '}
                onChange={onFieldChange}
                {...SHARED_CONTROL_PROPS}
              >
                <MenuItem value="aadhaar_card">Aadhaar card</MenuItem>
                <MenuItem value="voter_id">Voter ID</MenuItem>
                <MenuItem value="passport">Passport</MenuItem>
              </TextField>

              <UploadInput
                name="image_id_document"
                url={getAssetUrl((formState.values as FormStateValues).image_id_document)}
                buttonTitle="Upload ID Document Image"
                onFileChange={handleFileChange}
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
                <AppButton type="submit" disabled={inputDisabled || !formState.isValid || !validFiles()}>
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

export default DsaStep3View;
